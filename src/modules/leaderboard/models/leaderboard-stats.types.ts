import { Document, Types } from "mongoose";

export type PeriodType = "daily" | "weekly" | "monthly" | "all";

export interface ILeaderboardStats extends Document {
  userId: Types.ObjectId;
  periodType: PeriodType;
  periodStart: Date;
  avatarURL: string;
  totalWagered: number;
  totalWon: number;
  gamesPlayed: number;
  gamesWon: number;
}
