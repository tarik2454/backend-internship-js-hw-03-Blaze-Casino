import { Document } from "mongoose";

export interface IBonusSetting extends Document {
  baseAmount: number;
  cooldownSeconds: number;
  wagerBonusRate: number;
  gamesBonusAmount: number;
}
