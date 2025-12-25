import "dotenv/config";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { validateEnv } from "./config/env";
import crashWebSocketHandler from "./modules/crash/crash.ws.handler";

validateEnv();

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

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  crashWebSocketHandler.initialize(io);
  const crashManager = require("./modules/crash/crash.manager").default;
  crashManager.initialize();

  httpServer.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
    console.log(`WebSocket server ready on /crash namespace`);
  });
}

export default app;
