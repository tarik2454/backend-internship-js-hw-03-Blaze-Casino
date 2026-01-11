import { Types } from "mongoose";
import { User } from "../users/models/users.model";
import { IUser } from "../users/models/users.types";
import { ChatMessage } from "./models/chat-message.model";
import { IChatMessage } from "./models/chat-message.types";

class ChatService {
  async saveMessage(params: {
    roomId: string;
    username: string;
    text: string;
    userId?: string;
  }): Promise<IChatMessage | null> {
    try {
      const message = await ChatMessage.create(params);
      await this.trimRoomMessages(params.roomId);
      return message;
    } catch (err) {
      console.warn("[ChatService] Failed to save/trim message:", err);
      return null;
    }
  }

  async getHistory(roomId: string, limit = 100): Promise<IChatMessage[]> {
    try {
      const recent = await ChatMessage.find({ roomId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("userId", "username avatarURL")
        .lean();
      return recent.reverse() as IChatMessage[];
    } catch (err) {
      console.warn("[ChatService] Failed to load chat history:", err);
      return [];
    }
  }

  async getUser(userId: string): Promise<IUser | null> {
    return User.findById(userId);
  }

  private async trimRoomMessages(roomId: string): Promise<void> {
    try {
      const toDelete = await ChatMessage.find({ roomId })
        .sort({ createdAt: -1 })
        .skip(100)
        .select("_id")
        .lean();

      if (toDelete && toDelete.length) {
        const ids = toDelete.map((m: { _id: Types.ObjectId }) => m._id);
        await ChatMessage.deleteMany({ _id: { $in: ids } });
      }
    } catch (err) {
      console.warn(
        "[ChatService] Failed to trim messages for room",
        roomId,
        err
      );
    }
  }
}

export default new ChatService();
