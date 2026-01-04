import express from "express";
import chatController from "./chat.controller";
import {
  authenticate,
  collectRequestInfo,
  generalLimiter,
} from "../../middlewares";

const chatRouter = express.Router();

// GET /api/chat/:roomId/history - return last 100 messages for room
chatRouter.get(
  "/:roomId/history",
  authenticate,
  collectRequestInfo,
  generalLimiter,
  chatController.getChatHistory
);

export { chatRouter };
