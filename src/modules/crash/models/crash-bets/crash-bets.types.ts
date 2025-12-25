import { Document, Types } from "mongoose";

export interface ICrashBet extends Document {
  gameId: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  cashoutMultiplier?: number;
  winAmount?: number;
  autoCashout?: number;
  status: "active" | "won" | "lost";
  createdAt: Date;
}
