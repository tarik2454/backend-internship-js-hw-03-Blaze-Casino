import { Document, Types } from "mongoose";
import { IUser } from "../../users/models/users.types";

export interface IChatMessage extends Document {
  roomId: string;
  userId?: Types.ObjectId | IUser | string;
  username: string;
  text: string;
  createdAt: Date;
}
