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
} from "./chat.ws.types";

interface ExtendedSocket extends Socket {
  data: {
    username?: string;
    userId?: string;
    user?: IUser;
    joinedRooms?: Set<string>;
  };
}

/**
 * Инициализация WebSocket обработчика для чата
 * Настраивает обработку событий для корневого namespace Socket.IO
 */
export function initializeChatHandler(io: SocketIOServer): void {
  // Обработка подключения нового клиента
  io.on("connection", async (socket: ExtendedSocket) => {
    try {
      // Получение JWT токена из запроса аутентификации
      const token = socket.handshake.auth?.token as string;

      if (!token) {
        socket.emit("chat:error", {
          message: "Authentication token required",
        });
        socket.disconnect();
        return;
      }

      // Валидация токена и извлечение userId из payload
      const payload = tokenManager.verifyAccessToken(token);

      // Загрузка полного объекта пользователя из базы данных через сервис
      const user = await chatService.getUser(payload.userId);

      if (!user) {
        socket.emit("chat:error", { message: "User not found" });
        socket.disconnect();
        return;
      }

      // Сохранение данных пользователя в socket.data для использования в обработчиках событий
      socket.data.username = user.username;
      socket.data.userId = user._id.toString();
      socket.data.user = user;
      socket.data.joinedRooms = new Set<string>();

      // Отправка списка доступных комнат новому клиенту
      socket.emit("chat:rooms", CHAT_ROOMS);

      // Обработка присоединения к комнате
      socket.on("chat:join", async (data: ChatJoinEvent) => {
        // Проверка существования комнаты
        const roomExists = CHAT_ROOMS.some((room) => room.id === data.roomId);
        if (!roomExists) {
          socket.emit("chat:error", {
            message: `Room ${data.roomId} does not exist`,
          });
          return;
        }

        // Присоединение сокета к комнате
        socket.join(`room:${data.roomId}`);

        const room = CHAT_ROOMS.find((r) => r.id === data.roomId);
        const roomName = room?.name || data.roomId;

        
        // Отправляем уведомление ТОЛЬКО если это первое подключение к этой комнате
        if (!socket.data.joinedRooms?.has(data.roomId)) {
          const joinedText = `${socket.data.username} has joined ${roomName}`;

          // Сохраняем уведомление о входе
          const savedJoinMessage = await chatService.saveMessage({
            roomId: data.roomId,
            username: BOT_NAME,
            text: joinedText,
          });

          // Уведомление о новом участнике — отправляется всем в комнате, КРОМЕ присоединившегося
          // (присоединившийся не увидит это сообщение ни в реальном времени, ни в истории)
          socket.broadcast.to(`room:${data.roomId}`).emit("message", {
            _id: savedJoinMessage?._id?.toString(),
            roomId: data.roomId,
            ...formatMessage(BOT_NAME, joinedText, savedJoinMessage?.createdAt),
            createdAt: savedJoinMessage?.createdAt,
          });

          socket.data.joinedRooms?.add(data.roomId);
        }

        // Отправляем историю комнаты (последние 100 сообщений) только текущему пользователю
        // Исключаем сообщения о присоединении/выходе самого пользователя
        const history = await chatService.getHistory(data.roomId);
        const filteredHistory = history
          .filter((msg) => {
            // Пропускаем сообщения от бота о присоединении/выходе текущего пользователя
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
            // Форматируем сообщения из истории в том же формате, что и новые сообщения
            return {
              _id: msg._id?.toString(),
              username: msg.username,
              text: msg.text,
              userId: msg.userId?.toString(),
              time: formatMessage(msg.username, msg.text, msg.createdAt).time,
              createdAt: msg.createdAt,
            };
          });
        socket.emit("chat:history", {
          roomId: data.roomId,
          messages: filteredHistory,
        });
      });

      // Обработка покидания комнаты
      socket.on("chat:leave", async (data: ChatLeaveEvent) => {
        // Если пользователь действительно был в комнате
        if (socket.data.joinedRooms?.has(data.roomId)) {
          const room = CHAT_ROOMS.find((r) => r.id === data.roomId);
          const roomName = room?.name || data.roomId;
          const leftText = `${socket.data.username} has left ${roomName}`;

          // Сохраняем уведомление о выходе
          const savedLeaveMessage = await chatService.saveMessage({
            roomId: data.roomId,
            username: BOT_NAME,
            text: leftText,
          });

          // Уведомляем остальных участников комнаты о выходе пользователя
          // (покинувший не увидит это сообщение ни в реальном времени, ни в истории)
          socket.broadcast.to(`room:${data.roomId}`).emit("message", {
            _id: savedLeaveMessage?._id?.toString(),
            roomId: data.roomId,
            ...formatMessage(BOT_NAME, leftText, savedLeaveMessage?.createdAt),
            createdAt: savedLeaveMessage?.createdAt,
          });

          // Удаляем комнату из списка посещенных
          socket.data.joinedRooms.delete(data.roomId);
        }

        socket.leave(`room:${data.roomId}`);
      });

      // Обработка отправки сообщения в комнату
      socket.on("chat:message", async (data: ChatMessageEvent) => {
        // Проверка существования комнаты
        const roomExists = CHAT_ROOMS.some((room) => room.id === data.roomId);
        if (!roomExists) {
          socket.emit("chat:error", {
            message: `Room ${data.roomId} does not exist`,
          });
          return;
        }

        // Сохраняем сообщение в базе
        const savedMessage = await chatService.saveMessage({
          roomId: data.roomId,
          userId: data.userId,
          username: data.username,
          text: data.message,
        });

        // Отправка сообщения всем пользователям в комнате, включая отправителя
        // (публичное сообщение в комнате — видят все участники комнаты, включая отправителя)
        io.to(`room:${data.roomId}`).emit("message", {
          _id: savedMessage?._id?.toString(),
          roomId: data.roomId,
          userId: data.userId,
          ...formatMessage(
            data.username,
            data.message,
            savedMessage?.createdAt
          ),
          createdAt: savedMessage?.createdAt,
        });
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
