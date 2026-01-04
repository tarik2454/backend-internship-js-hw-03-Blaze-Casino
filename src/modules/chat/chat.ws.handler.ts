import { Server as SocketIOServer, Socket } from "socket.io";
import { tokenManager } from "../auth/tokens";
import { formatMessage, saveChatMessageAndTrim } from "./chat.utils";
import { CHAT_ROOMS, BOT_NAME } from "./chat.config";
import { IUser } from "../users/models/users.types";
import { User } from "../users/models/users.model";
import { ChatMessage } from "./models/chat-message.model";

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

      // Загрузка полного объекта пользователя из базы данных
      const user = await User.findById(payload.userId);

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

      // Обработка отключения клиента
      socket.on("disconnect", async () => {
        const disconnectedUsername = socket.data.username || "Anonymous";
        const text = `User ${disconnectedUsername} has left the chat`;

        // Сохраняем бот-сообщение в общей комнате (без фейлов)
        try {
          await saveChatMessageAndTrim({
            roomId: "general",
            username: BOT_NAME,
            text,
          });
        } catch (err) {
          console.warn("[Chat] Failed to save disconnect message:", err);
        }

        // Уведомление всех подключенных пользователей о выходе (видно всем)
        io.emit("message", formatMessage(BOT_NAME, text));
      });

      // Обработка присоединения к комнате
      socket.on("chat:join", async (data: { roomId: string }) => {
        // Проверка существования комнаты
        const roomExists = CHAT_ROOMS.some((room) => room.id === data.roomId);
        if (!roomExists) {
          socket.emit("chat:error", {
            message: `Room ${data.roomId} does not exist`,
          });
          return;
        }

        // Проверка, является ли это первым присоединением к комнате
        const isFirstJoin = !socket.data.joinedRooms?.has(data.roomId);

        // Присоединение сокета к комнате
        socket.join(`room:${data.roomId}`);

        const room = CHAT_ROOMS.find((r) => r.id === data.roomId);
        const roomName = room?.name || data.roomId;

        // Отправка приветственного сообщения только при первом присоединении
        if (isFirstJoin) {
          const welcomeText = `Welcome ${socket.data.username} to ${roomName}!`;
          const joinedText = `${socket.data.username} has joined ${roomName}`;

          // Сохраняем приветственное и нотификационное сообщения
          try {
            await saveChatMessageAndTrim({
              roomId: data.roomId,
              username: BOT_NAME,
              text: welcomeText,
            });
            await saveChatMessageAndTrim({
              roomId: data.roomId,
              username: BOT_NAME,
              text: joinedText,
            });
          } catch (err) {
            console.warn("[Chat] Failed to save join messages:", err);
          }

          // Приветствие — отправляется только текущему пользователю (видно ТОЛЬКО присоединившемуся)
          socket.emit("message", {
            roomId: data.roomId,
            ...formatMessage(BOT_NAME, welcomeText),
          });

          // Уведомление об новом участнике — отправляется всем в комнате, КРОМЕ присоединившегося
          // (видно другим участникам комнаты, но не видно тому, кто только что присоединился)
          socket.broadcast.to(`room:${data.roomId}`).emit("message", {
            roomId: data.roomId,
            ...formatMessage(BOT_NAME, joinedText),
          });

          socket.data.joinedRooms?.add(data.roomId);
        }

        // Отправляем историю комнаты (последние 100 сообщений) только текущему пользователю
        try {
          const recent = await ChatMessage.find({ roomId: data.roomId })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
          socket.emit("chat:history", {
            roomId: data.roomId,
            messages: recent.reverse(),
          });
        } catch (err) {
          console.warn("[Chat] Failed to load chat history:", err);
        }
      });

      // Обработка покидания комнаты
      socket.on("chat:leave", (data: { roomId: string }) => {
        socket.leave(`room:${data.roomId}`);
      });

      // Обработка отправки сообщения в комнату
      socket.on(
        "chat:message",
        async (data: {
          roomId: string;
          message: string;
          username: string;
          userId: string;
        }) => {
          // Проверка существования комнаты
          const roomExists = CHAT_ROOMS.some((room) => room.id === data.roomId);
          if (!roomExists) {
            socket.emit("chat:error", {
              message: `Room ${data.roomId} does not exist`,
            });
            return;
          }

          // Сохраняем сообщение в базе
          try {
            await saveChatMessageAndTrim({
              roomId: data.roomId,
              userId: data.userId,
              username: data.username,
              text: data.message,
            });
          } catch (err) {
            console.warn("[Chat] Failed to save message:", err);
          }

          // Отправка сообщения всем пользователям в комнате, включая отправителя
          // (публичное сообщение в комнате — видят все участники комнаты, включая отправителя)
          io.to(`room:${data.roomId}`).emit("message", {
            roomId: data.roomId,
            userId: data.userId,
            ...formatMessage(data.username, data.message),
          });
        }
      );
    } catch (error) {
      socket.emit("chat:error", { message: "Invalid authentication token" });
      socket.disconnect();
    }
  });
}

/**
 * Справочник методов Socket.IO Broadcast:
 *
 * socket.emit()                    → Только текущему сокету (видно ТОЛЬКО отправителю)
 * socket.broadcast.emit()          → Всем подключенным, КРОМЕ текущего сокета (не видно отправителю)
 * io.emit()                        → Всем подключенным пользователям глобально, включая отправителя (видно всем)
 * io.to(room).emit()               → Всем пользователям в комнате, включая отправителя (видно всем в комнате)
 * socket.broadcast.to(room).emit() → Всем пользователям в комнате, КРОМЕ текущего (не видно отправителю)
 */
