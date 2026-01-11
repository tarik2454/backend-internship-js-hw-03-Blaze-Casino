import mongoose, { Model } from "mongoose";
import { IChatMessage } from "./chat-message.types";

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: { type: String, required: true },
    text: { type: String, required: true },
  },
  { versionKey: false, timestamps: true }
);

const ChatMessage: Model<IChatMessage> = mongoose.model<IChatMessage>(
  "ChatMessage",
  chatMessageSchema
);

export { ChatMessage };
