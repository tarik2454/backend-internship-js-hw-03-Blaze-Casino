import { Document, Types } from "mongoose";

export interface IPlinkoDrop extends Document {
  userId: Types.ObjectId;
  betAmount: number;
  ballsCount: number;
  riskLevel: "low" | "medium" | "high";
  linesCount: number;
  completed: boolean;
  completedAt?: Date;
  status?: "won" | "lost";
  createdAt: Date;
  updatedAt: Date;
}
