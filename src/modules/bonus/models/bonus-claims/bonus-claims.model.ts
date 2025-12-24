import { Schema, model } from "mongoose";
import { IBonusClaim } from "./bonus-claims.types";

const bonusClaimSchema = new Schema<IBonusClaim>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false, timestamps: false }
);

bonusClaimSchema.index({ userId: 1, claimedAt: -1 });
bonusClaimSchema.index({ claimedAt: -1 });

export const BonusClaim = model<IBonusClaim>("BonusClaim", bonusClaimSchema);
