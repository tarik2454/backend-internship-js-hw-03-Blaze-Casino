import { Document } from "mongoose";

export interface IChatMessage extends Document {
  roomId: string;
  userId?: string;
  username: string;
  text: string;
  createdAt: Date;
}
