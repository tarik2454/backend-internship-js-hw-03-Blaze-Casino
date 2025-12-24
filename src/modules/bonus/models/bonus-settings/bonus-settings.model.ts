import { Schema, model } from "mongoose";
import { IBonusSetting } from "./bonus-settings.types";

const bonusSettingSchema = new Schema<IBonusSetting>(
  {
    baseAmount: {
      type: Number,
      default: 10,
      required: true,
    },
    cooldownSeconds: {
      type: Number,
      default: 60,
      required: true,
    },
    wagerBonusRate: {
      type: Number,
      default: 0.001,
      required: true,
    },
    gamesBonusAmount: {
      type: Number,
      default: 1,
      required: true,
    },
  },
  { versionKey: false, timestamps: false }
);

export const BonusSetting = model<IBonusSetting>(
  "BonusSetting",
  bonusSettingSchema
);
