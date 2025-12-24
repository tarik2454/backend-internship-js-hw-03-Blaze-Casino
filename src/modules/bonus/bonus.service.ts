import { HydratedDocument, Types } from "mongoose";
import { IUser } from "../users/models/users.types";
import { BonusStatusResponse, ClaimBonusResponse } from "./bonus.types";
import { HttpError } from "../../helpers/index";
import { BonusClaim } from "./models/bonus-claims/bonus-claims.model";
import { BonusSetting } from "./models/bonus-settings/bonus-settings.model";

class BonusService {
  private async getSettings() {
    let settings = await BonusSetting.findOne();
    if (!settings) {
      settings = await BonusSetting.create({});
    }
    return settings;
  }

  private async getLastClaimAt(userId: Types.ObjectId): Promise<Date | null> {
    const lastClaim = await BonusClaim.findOne({ userId })
      .sort({ claimedAt: -1 })
      .select("claimedAt")
      .lean();

    return lastClaim?.claimedAt || null;
  }

  private async getNextClaimAt(
    userId: Types.ObjectId,
    cooldownSeconds: number
  ): Promise<Date> {
    const lastClaimAt = await this.getLastClaimAt(userId);
    const now = new Date();

    if (!lastClaimAt) {
      return now;
    }

    const cooldownMs = cooldownSeconds * 1000;
    const nextClaim = new Date(lastClaimAt.getTime() + cooldownMs);
    return nextClaim > now ? nextClaim : now;
  }

  async getStatus(user: HydratedDocument<IUser>): Promise<BonusStatusResponse> {
    const settings = await this.getSettings();

    const fixedAmount = 10;
    const baseAmount = fixedAmount;
    const wagerBonus = 0;
    const gamesBonus = 0;
    const amount = fixedAmount;

    const nextClaimAt = await this.getNextClaimAt(
      user._id,
      settings.cooldownSeconds
    );

    return {
      nextClaimAt: nextClaimAt.toISOString(),
      amount,
      baseAmount,
      wagerBonus,
      gamesBonus,
    };
  }

  async claimBonus(user: HydratedDocument<IUser>): Promise<ClaimBonusResponse> {
    const settings = await this.getSettings();
    const now = new Date();

    const lastClaimAt = await this.getLastClaimAt(user._id);

    if (lastClaimAt) {
      const cooldownMs = settings.cooldownSeconds * 1000;
      const timeSinceLastClaim = now.getTime() - lastClaimAt.getTime();

      if (timeSinceLastClaim < cooldownMs) {
        const waitTime = Math.ceil((cooldownMs - timeSinceLastClaim) / 1000);
        throw HttpError(
          429,
          `You can claim bonus again in ${waitTime} seconds`
        );
      }
    }

    const fixedAmount = 10;
    const amount = fixedAmount;

    user.balance += amount;
    await user.save();

    await BonusClaim.create({
      userId: user._id,
      amount,
      claimedAt: now,
    });

    const nextClaimAt = await this.getNextClaimAt(
      user._id,
      settings.cooldownSeconds
    );

    return {
      amount,
      balance: user.balance,
      nextClaimAt: nextClaimAt.toISOString(),
    };
  }
}

export default new BonusService();
