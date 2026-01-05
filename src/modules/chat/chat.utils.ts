import { Types } from "mongoose";
import { ChatMessage } from "./models/chat-message.model";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatMessage(
  username: string,
  text: string,
  createdAt?: Date
): {
  username: string;
  text: string;
  time: string;
} {
  return {
    username,
    text,
    time: formatTime(createdAt || new Date()),
  };
}

export async function trimRoomMessages(roomId: string) {
  try {
    const toDelete = await ChatMessage.find({ roomId })
      .sort({ createdAt: -1 })
      .skip(100)
      .select("_id")
      .lean();

    if (toDelete && toDelete.length) {
      const ids: Types.ObjectId[] = toDelete.map(
        (m: { _id: Types.ObjectId }) => m._id
      );
      await ChatMessage.deleteMany({ _id: { $in: ids } });
    }
  } catch (err) {
    console.warn("[Chat] Failed to trim messages for room", roomId, err);
  }
}

export async function saveChatMessageAndTrim(params: {
  roomId: string;
  username: string;
  text: string;
  userId?: string;
}) {
  try {
    await ChatMessage.create(params);
    await trimRoomMessages(params.roomId);
  } catch (err) {
    console.warn("[Chat] Failed to save/trim message:", err);
  }
}
