import { Schema, model } from "mongoose";
import { IBonusSetting } from "./bonus-settings.types";

const bonusSettingSchema = new Schema<IBonusSetting>(
  {
    baseAmount: {
      type: Number,
      default: 10,
      required: true,
      min: 0,
    },
    cooldownSeconds: {
      type: Number,
      default: 60,
      required: true,
      min: 0,
    },
    wagerBonusRate: {
      type: Number,
      default: 0.001,
      required: true,
      min: 0,
    },
    wagerBonusStep: {
      type: Number,
      default: 1,
      required: true,
      min: 0.01,
    },
    gamesBonusAmount: {
      type: Number,
      default: 1,
      required: true,
      min: 0,
    },
    gamesBonusStep: {
      type: Number,
      default: 10,
      required: true,
      min: 1,
    },
  },
  { versionKey: false, timestamps: false }
);

export const BonusSetting = model<IBonusSetting>(
  "BonusSetting",
  bonusSettingSchema
);
