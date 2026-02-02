import { Schema, model } from "mongoose";
import { IMinesGame } from "./mines.types";

const minesGameSchema = new Schema<IMinesGame>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    betAmount: { type: Number, required: true },
    gridSize: { type: Number, required: true, min: 5, max: 8 },
    minesCount: {
      type: Number,
      required: true,
      min: 1,
      max: 63,
    },
    minePositions: {
      type: [Number],
      required: true,
      validate: {
        validator: function (this: IMinesGame, arr: number[]) {
          const maxPos = this.gridSize * this.gridSize - 1;
          return arr.every((p) => p >= 0 && p <= maxPos);
        },
        message: "Mine positions must be between 0 and gridSize² - 1",
      },
    },
    revealedPositions: {
      type: [Number],
      default: [],
      validate: {
        validator: function (this: IMinesGame, arr: number[]) {
          const maxPos = this.gridSize * this.gridSize - 1;
          return arr.every((p) => p >= 0 && p <= maxPos);
        },
        message: "Revealed positions must be between 0 and gridSize² - 1",
      },
    },
    status: {
      type: String,
      enum: ["active", "won", "lost", "cashed_out"],
      required: true,
      default: "active",
    },
    cashoutMultiplier: { type: Number },
    winAmount: { type: Number },
    serverSeed: { type: String, required: true, maxlength: 64 },
    serverSeedHash: { type: String, required: true, maxlength: 64 },
    clientSeed: { type: String, required: true, maxlength: 64 },
    nonce: { type: Number, required: true },
    finishedAt: { type: Date },
  },
  {
    versionKey: false,
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

minesGameSchema.index({ userId: 1, status: 1 });
minesGameSchema.index({ userId: 1, createdAt: -1 });

export const MinesGame = model<IMinesGame>("MinesGame", minesGameSchema);
