import { Response } from "express";
import { ctrlWrapper } from "../../decorators";
import { AuthenticatedRequest } from "../../types";
import chatService from "./chat.service";
import { CHAT_ROOMS } from "./chat.config";

const getChatHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const roomId = (req.params.roomId || "").toString();

  const roomExists = CHAT_ROOMS.some((r) => r.id === roomId);
  if (!roomExists) {
    res.status(400).json({ message: `Room ${roomId} does not exist` });
    return;
  }

  const messages = await chatService.getHistory(roomId);
  res.json({ roomId, messages });
};

export default {
  getChatHistory: ctrlWrapper(getChatHistory),
};
