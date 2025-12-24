import { Document, Types } from "mongoose";

export interface IBonusClaim extends Document {
  userId: Types.ObjectId;
  amount: number;
  claimedAt: Date;
}
