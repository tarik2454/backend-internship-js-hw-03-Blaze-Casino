import { Document, Types } from "mongoose";

export interface IRefreshToken extends Document {
  token: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  sessionStart?: Date;
}
