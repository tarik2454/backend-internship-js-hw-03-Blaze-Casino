import { Document } from "mongoose";

export interface IBonusSetting extends Document {
  baseAmount: number;
  cooldownSeconds: number;
  wagerBonusStep: number;
  wagerBonusAmount: number;
  gamesBonusStep: number;
  gamesBonusAmount: number;
}
