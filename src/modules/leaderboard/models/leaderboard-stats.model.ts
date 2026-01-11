import mongoose, { Schema, Model } from "mongoose";
import { ILeaderboardStats } from "./leaderboard-stats.types";

const leaderboardStatsSchema = new Schema<ILeaderboardStats>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    periodType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "all"],
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    avatarURL: {
      type: String,
      default: null,
    },
    totalWagered: {
      type: Number,
      default: 0,
    },
    totalWon: {
      type: Number,
      default: 0,
    },
    gamesPlayed: {
      type: Number,
      default: 0,
    },
    gamesWon: {
      type: Number,
      default: 0,
    },
  },
  { versionKey: false, timestamps: false }
);

leaderboardStatsSchema.index(
  { userId: 1, periodType: 1, periodStart: 1 },
  { unique: true }
);
leaderboardStatsSchema.index({
  periodType: 1,
  periodStart: 1,
  totalWagered: -1,
});

export const LeaderboardStats: Model<ILeaderboardStats> =
  mongoose.model<ILeaderboardStats>("LeaderboardStats", leaderboardStatsSchema);
