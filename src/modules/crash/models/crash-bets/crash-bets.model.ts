import { Schema, model } from "mongoose";
import { ICrashBet } from "./crash-bets.types";

const crashBetSchema = new Schema<ICrashBet>(
  {
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "CrashGame",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.1,
    },
    cashoutMultiplier: {
      type: Number,
      min: 1.0,
    },
    winAmount: {
      type: Number,
      min: 0,
    },
    autoCashout: {
      type: Number,
      min: 1.0,
    },
    status: {
      type: String,
      enum: ["active", "won", "lost"],
      required: true,
      default: "active",
    },
  },
  {
    versionKey: false,
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

crashBetSchema.index({ gameId: 1, userId: 1 });
crashBetSchema.index({ userId: 1, createdAt: -1 });
crashBetSchema.index({ gameId: 1, status: 1 });

export const CrashBet = model<ICrashBet>("CrashBet", crashBetSchema);
