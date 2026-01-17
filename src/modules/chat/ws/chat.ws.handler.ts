import { Server as SocketIOServer, Socket } from "socket.io";
import { tokenManager } from "../../auth/tokens";
import { formatMessage } from "../chat.utils";
import { CHAT_ROOMS, BOT_NAME } from "../chat.config";
import { IUser } from "../../users/models/users.types";
import chatService from "../chat.service";
import {
  ChatJoinEvent,
  ChatLeaveEvent,
  ChatMessageEvent,
  ChatRoomWithUsers,
  ChatRoomUsersEvent,
} from "./chat.ws.types";

interface ExtendedSocket extends Socket {
  data: {
    username?: string;
    userId?: string;
    user?: IUser;
    joinedRooms?: Set<string>;
  };
}

function getRoomUserCount(io: SocketIOServer, roomId: string): number {
  const roomName = `room:${roomId}`;
  const room = io.sockets.adapter.rooms.get(roomName);
  return room ? room.size : 0;
}

function emitRoomUsersUpdate(
  io: SocketIOServer,
  roomId: string
): void {
  const activeUsers = getRoomUserCount(io, roomId);
  io.to(`room:${roomId}`).emit("chat:room:users", {
    roomId,
    activeUsers,
  } as ChatRoomUsersEvent);
}

export function initializeChatHandler(io: SocketIOServer): void {
  io.on("connection", async (socket: ExtendedSocket) => {
    try {
      const token = socket.handshake.auth?.token as string;

      if (!token) {
        socket.emit("chat:error", {
          message: "Authentication token required",
        });
        socket.disconnect();
        return;
      }

      const payload = tokenManager.verifyAccessToken(token);

      const user = await chatService.getUser(payload.userId);

      if (!user) {
        socket.emit("chat:error", { message: "User not found" });
        socket.disconnect();
        return;
      }

      socket.data.username = user.username;
      socket.data.userId = user._id.toString();
      socket.data.user = user;
      socket.data.joinedRooms = new Set<string>();

      const roomsWithUsers: ChatRoomWithUsers[] = CHAT_ROOMS.map((room) => ({
        id: room.id,
        name: room.name,
        activeUsers: getRoomUserCount(io, room.id),
      }));
      socket.emit("chat:rooms", roomsWithUsers);

      socket.on("chat:join", async (data: ChatJoinEvent) => {
        const roomExists = CHAT_ROOMS.some((room) => room.id === data.roomId);
        if (!roomExists) {
          socket.emit("chat:error", {
            message: `Room ${data.roomId} does not exist`,
          });
          return;
        }

        socket.join(`room:${data.roomId}`);

        const room = CHAT_ROOMS.find((r) => r.id === data.roomId);
        const roomName = room?.name || data.roomId;

        if (!socket.data.joinedRooms?.has(data.roomId)) {
          const joinedText = `${socket.data.username} has joined ${roomName}`;

          const savedJoinMessage = await chatService.saveMessage({
            roomId: data.roomId,
            username: BOT_NAME,
            text: joinedText,
          });

          socket.broadcast.to(`room:${data.roomId}`).emit("message", {
            _id: savedJoinMessage?._id?.toString(),
            roomId: data.roomId,
            ...formatMessage(BOT_NAME, joinedText, savedJoinMessage?.createdAt),
            createdAt: savedJoinMessage?.createdAt,
          });

          socket.data.joinedRooms?.add(data.roomId);
        }

        const history = await chatService.getHistory(data.roomId);
        const filteredHistory = history
          .filter((msg) => {
            if (msg.username === BOT_NAME && socket.data.username) {
              const userJoinedPattern = new RegExp(
                `^${socket.data.username} has joined`,
                "i"
              );
              const userLeftPattern = new RegExp(
                `^${socket.data.username} has left`,
                "i"
              );
              if (
                userJoinedPattern.test(msg.text) ||
                userLeftPattern.test(msg.text)
              ) {
                return false;
              }
            }
            return true;
          })
          .map((msg) => {
            let avatarURL: string | null = null;
            if (
              msg.userId &&
              typeof msg.userId === "object" &&
              "avatarURL" in msg.userId
            ) {
              const user = msg.userId as unknown as { avatarURL?: string };
              avatarURL = user.avatarURL || null;
            }

            let userIdString: string | null = null;
            if (msg.userId) {
              if (typeof msg.userId === "object" && "_id" in msg.userId) {
                const userWithId = msg.userId as IUser;
                userIdString = userWithId._id.toString();
              } else {
                userIdString = String(msg.userId);
              }
            }

            return {
              _id: msg._id?.toString(),
              username: msg.username,
              text: msg.text,
              userId: userIdString,
              avatarURL,
              time: formatMessage(msg.username, msg.text, msg.createdAt).time,
              createdAt: msg.createdAt,
            };
          });
        socket.emit("chat:history", {
          roomId: data.roomId,
          messages: filteredHistory,
        });

        emitRoomUsersUpdate(io, data.roomId);
      });

      socket.on("chat:leave", async (data: ChatLeaveEvent) => {
        if (socket.data.joinedRooms?.has(data.roomId)) {
          const room = CHAT_ROOMS.find((r) => r.id === data.roomId);
          const roomName = room?.name || data.roomId;
          const leftText = `${socket.data.username} has left ${roomName}`;

          const savedLeaveMessage = await chatService.saveMessage({
            roomId: data.roomId,
            username: BOT_NAME,
            text: leftText,
          });

          socket.broadcast.to(`room:${data.roomId}`).emit("message", {
            _id: savedLeaveMessage?._id?.toString(),
            roomId: data.roomId,
            ...formatMessage(BOT_NAME, leftText, savedLeaveMessage?.createdAt),
            createdAt: savedLeaveMessage?.createdAt,
          });

          socket.data.joinedRooms.delete(data.roomId);
        }

        socket.leave(`room:${data.roomId}`);

        emitRoomUsersUpdate(io, data.roomId);
      });

      socket.on("chat:message", async (data: ChatMessageEvent) => {
        const roomExists = CHAT_ROOMS.some((room) => room.id === data.roomId);
        if (!roomExists) {
          socket.emit("chat:error", {
            message: `Room ${data.roomId} does not exist`,
          });
          return;
        }

        const savedMessage = await chatService.saveMessage({
          roomId: data.roomId,
          userId: data.userId,
          username: data.username,
          text: data.message,
        });

        io.to(`room:${data.roomId}`).emit("message", {
          _id: savedMessage?._id?.toString(),
          roomId: data.roomId,
          userId: data.userId,
          avatarURL: socket.data.user?.avatarURL || null,
          ...formatMessage(
            data.username,
            data.message,
            savedMessage?.createdAt
          ),
          createdAt: savedMessage?.createdAt,
        });
      });

      socket.on("disconnect", () => {
        if (socket.data.joinedRooms) {
          socket.data.joinedRooms.forEach((roomId) => {
            emitRoomUsersUpdate(io, roomId);
          });
        }
      });
    } catch (error) {
      socket.emit("chat:error", { message: "Invalid authentication token" });
      socket.disconnect();
    }
  });
}

/**
 * Справочник методов Socket.IO:
 *
 * === ОТПРАВКА СООБЩЕНИЙ ===
 * socket.emit(event, data)                    → Только текущему сокету (видно ТОЛЬКО отправителю)
 * socket.broadcast.emit(event, data)          → Всем подключенным, КРОМЕ текущего сокета (не видно отправителю)
 * io.emit(event, data)                        → Всем подключенным пользователям глобально, включая отправителя (видно всем)
 * io.to(room).emit(event, data)               → Всем пользователям в комнате, включая отправителя (видно всем в комнате)
 * socket.broadcast.to(room).emit(event, data) → Всем пользователям в комнате, КРОМЕ текущего (не видно отправителю)
 * socket.to(room).emit(event, data)           → Всем в комнате, КРОМЕ текущего сокета (аналог broadcast.to)
 *
 * === УПРАВЛЕНИЕ КОМНАТАМИ ===
 * socket.join(room)                           → Присоединение сокета к комнате
 * socket.leave(room)                          → Выход сокета из комнаты
 * socket.rooms                                → Set комнат, в которых находится сокет
 * socket.in(room).emit(event, data)           → Альтернативный синтаксис для io.to(room).emit()
 *
 * === ПОДКЛЮЧЕНИЕ И ОТКЛЮЧЕНИЕ ===
 * socket.disconnect()                         → Принудительное отключение сокета
 * socket.connected                            → Boolean: подключен ли сокет
 * socket.id                                   → Уникальный ID сокета
 *
 * === ОБРАБОТКА СОБЫТИЙ ===
 * socket.on(event, callback)                  → Подписка на событие от клиента
 * socket.once(event, callback)                 → Подписка на событие один раз
 * socket.off(event, callback)                  → Отписка от события
 * io.on(event, callback)                       → Подписка на событие на уровне сервера (например, "connection")
 *
 * === ДАННЫЕ СОКЕТА ===
 * socket.handshake                            → Данные handshake запроса (auth, headers, query и т.д.)
 * socket.data                                 → Произвольные данные, привязанные к сокету
 */
