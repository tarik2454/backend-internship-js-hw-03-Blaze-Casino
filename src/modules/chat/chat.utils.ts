import moment from "moment";
import { Types } from "mongoose";
import { ChatMessage } from "./models/chat-message.model";

export function formatMessage(
  username: string,
  text: string
): {
  username: string;
  text: string;
  time: string;
} {
  return {
    username,
    text,
    time: moment().format("h:mm a"),
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
