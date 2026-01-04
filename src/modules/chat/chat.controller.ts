import { Response } from "express";
import { ctrlWrapper } from "../../decorators";
import { AuthenticatedRequest } from "../../types";
import { ChatMessage } from "./models/chat-message.model";
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

  const recent = await ChatMessage.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({ roomId, messages: recent.reverse() });
};

export default {
  getChatHistory: ctrlWrapper(getChatHistory),
};
