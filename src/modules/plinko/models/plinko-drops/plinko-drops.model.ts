import { Schema, model } from "mongoose";
import { IPlinkoDrop } from "./plinko-drops.types";

const plinkoDropSchema = new Schema<IPlinkoDrop>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    betAmount: { type: Number, required: true },
    ballsCount: { type: Number, default: 1 },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },
    linesCount: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    status: { type: String, enum: ["won", "lost"] },
  },
  { timestamps: true, versionKey: false },
);

plinkoDropSchema.index({ userId: 1, createdAt: -1 });

export const PlinkoDrop = model<IPlinkoDrop>("PlinkoDrop", plinkoDropSchema);
