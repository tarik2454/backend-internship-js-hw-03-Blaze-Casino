import "dotenv/config";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { validateEnv } from "./config/env";
import app from "./app";
import crashWebSocketHandler from "./modules/crash/crash.ws.handler";

validateEnv();

const PORT = process.env.PORT || 3000;

// Database connection
mongoose
  .connect(process.env.DB_HOST as string, {
    writeConcern: { w: "majority" },
  })
  .then(() => {
    console.log("Database connection successful");
  })
  .catch((error: Error) => {
    console.warn("Database connection error:", error.message);
  });

// HTTP server and socket.io server
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// Socket.io server connection
io.on("connection", (socket) => {
  console.log(`New socket.io connection: ${socket.id}`);

  socket.emit("message", {
    message: "Welcome to ChatCord!",
    roomId: "general",
  });

  // Присоединение к комнате
  socket.on("chat:join", (data: { roomId: string }) => {
    socket.join(`room:${data.roomId}`);
    console.log(`[Chat] ${socket.id} joined room: ${data.roomId}`);
  });

  // Покидание комнаты
  socket.on("chat:leave", (data: { roomId: string }) => {
    socket.leave(`room:${data.roomId}`);
    console.log(`[Chat] ${socket.id} left room: ${data.roomId}`);
  });

  // Отправка сообщения
  socket.on(
    "chat:message",
    (data: {
      roomId: string;
      message: string;
      username: string;
      userId: string;
    }) => {
      console.log(
        `[Chat] Message from ${socket.id} in room ${data.roomId}:`,
        data.message
      );

      // Отправить сообщение всем в комнате
      io.to(`room:${data.roomId}`).emit("message", {
        roomId: data.roomId,
        message: data.message,
        username: data.username,
        userId: data.userId,
        timestamp: new Date(),
      });
    }
  );

  socket.on("disconnect", () => {
    console.log(`Socket.io client disconnected: ${socket.id}`);
  });
});

crashWebSocketHandler.initialize(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
  console.log(`WebSocket server ready on /crash namespace`);
  console.log(`WebSocket server ready on (/) root namespace`);
  console.log(`Waiting for socket connections...`);
});

export default app;
