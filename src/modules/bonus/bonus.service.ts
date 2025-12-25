import { HydratedDocument, Types } from "mongoose";
import { IUser } from "../users/models/users.types";
import { User } from "../users/models/users.model";
import { BonusStatusResponse, ClaimBonusResponse } from "./bonus.types";
import { HttpError } from "../../helpers/index";
import { BonusClaim } from "./models/bonus-claims/bonus-claims.model";
import { BonusSetting } from "./models/bonus-settings/bonus-settings.model";
import auditService from "../audit/audit.service";

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

  private async getLastClaim(userId: Types.ObjectId) {
    const lastClaim = await BonusClaim.findOne({ userId })
      .sort({ claimedAt: -1 })
      .select("usedWagered usedGamesPlayed")
      .lean();

    return lastClaim || null;
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

  private calculateBonus(
    user: HydratedDocument<IUser>,
    settings: {
      baseAmount: number;
      wagerBonusStep: number;
      wagerBonusRate: number;
      gamesBonusStep: number;
      gamesBonusAmount: number;
    },
    usedWagered = 0,
    usedGamesPlayed = 0
  ) {
    const baseAmount = settings.baseAmount;
    const availableWagered = Math.max(
      0,
      (user.totalWagered || 0) - usedWagered
    );
    const wagerBonus =
      Math.floor(
        (availableWagered / settings.wagerBonusStep) *
          settings.wagerBonusRate *
          100
      ) / 100;

    const availableGamesPlayed = Math.max(
      0,
      (user.gamesPlayed || 0) - usedGamesPlayed
    );
    const gamesBonus =
      Math.floor(availableGamesPlayed / settings.gamesBonusStep) *
      settings.gamesBonusAmount;

    const amount =
      Math.floor((baseAmount + wagerBonus + gamesBonus) * 100) / 100;

    const usedWageredForBonus = availableWagered;
    const usedGamesPlayedForBonus = availableGamesPlayed;

    return {
      baseAmount,
      wagerBonus,
      gamesBonus,
      amount,
      usedWagered: usedWagered + usedWageredForBonus,
      usedGamesPlayed: usedGamesPlayed + usedGamesPlayedForBonus,
    };
  }

  async getStatus(user: HydratedDocument<IUser>): Promise<BonusStatusResponse> {
    const settings = await this.getSettings();
    const lastClaim = await this.getLastClaim(user._id);
    const usedWagered = lastClaim?.usedWagered || 0;
    const usedGamesPlayed = lastClaim?.usedGamesPlayed || 0;

    const bonus = this.calculateBonus(
      user,
      settings,
      usedWagered,
      usedGamesPlayed
    );

    const nextClaimAt = await this.getNextClaimAt(
      user._id,
      settings.cooldownSeconds
    );

    return {
      nextClaimAt: nextClaimAt.toISOString(),
      amount: bonus.amount,
      baseAmount: bonus.baseAmount,
      wagerBonus: bonus.wagerBonus,
      gamesBonus: bonus.gamesBonus,
    };
  }

  async claimBonus(
    user: HydratedDocument<IUser>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ClaimBonusResponse> {
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

    const lastClaim = await this.getLastClaim(user._id);
    const usedWagered = lastClaim?.usedWagered || 0;
    const usedGamesPlayed = lastClaim?.usedGamesPlayed || 0;

    const bonus = this.calculateBonus(
      user,
      settings,
      usedWagered,
      usedGamesPlayed
    );
    const oldBalance = user.balance;

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $inc: { balance: bonus.amount },
      },
      { new: true }
    );

    if (!updatedUser) {
      throw HttpError(404, "User not found");
    }

    const claim = await BonusClaim.create({
      userId: user._id,
      amount: bonus.amount,
      usedWagered: bonus.usedWagered,
      usedGamesPlayed: bonus.usedGamesPlayed,
      claimedAt: now,
    });

    const nextClaimAt = await this.getNextClaimAt(
      user._id,
      settings.cooldownSeconds
    );

    auditService
      .log({
        userId: user._id,
        action: "CLAIM_BONUS",
        entityType: "BonusClaim",
        entityId: claim._id,
        oldValue: {
          balance: oldBalance,
        },
        newValue: {
          balance: updatedUser.balance,
          amount: bonus.amount,
          nextClaimAt: nextClaimAt.toISOString(),
        },
        ipAddress,
        userAgent,
      })
      .catch((err) => {
        console.error("Audit log failed:", err);
      });

    return {
      amount: bonus.amount,
      balance: updatedUser.balance,
      nextClaimAt: nextClaimAt.toISOString(),
    };
  }
}

export default new BonusService();
