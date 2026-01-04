import express from "express";
import chatController from "./chat.controller";
import {
  authenticate,
  collectRequestInfo,
  generalLimiter,
} from "../../middlewares";

const chatRouter = express.Router();

chatRouter.get(
  "/:roomId/history",
  authenticate,
  collectRequestInfo,
  generalLimiter,
  chatController.getChatHistory
);

export { chatRouter };
