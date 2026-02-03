import crypto from "crypto";
import mongoose from "mongoose";
import { User } from "../users/models/users.model";
import { PlinkoDrop } from "./models/plinko-drops/plinko-drops.model";
import { PlinkoResult } from "./models/plinko-results/plinko-results.model";
import { HttpError } from "../../helpers";
import leaderboardService from "../leaderboard/leaderboard.service";
import auditService from "../audit/audit.service";

export class PlinkoService {
  private static readonly MULTIPLIERS = {
    16: {
      low: [
        16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16,
      ],
      medium: [
        110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110,
      ],
      high: [
        1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000,
      ],
    },
    8: {
      low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
      medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
      high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    },
  };

  private static generateMultipliersForLines(
    lines: number,
    risk: "low" | "medium" | "high",
  ): number[] {
    const base8 = this.MULTIPLIERS[8][risk];
    const base16 = this.MULTIPLIERS[16][risk];

    if (lines === 8) return base8;
    if (lines === 16) return base16;

    const ratio = (lines - 8) / (16 - 8);
    const slotCount = lines + 1;
    const multipliers: number[] = [];

    for (let i = 0; i < slotCount; i++) {
      const pos8 = (i / lines) * 8;
      const pos16 = (i / lines) * 16;

      const idx8 = Math.round(pos8);
      const idx16 = Math.round(pos16);
      const val8 = base8[Math.min(idx8, base8.length - 1)];
      const val16 = base16[Math.min(idx16, base16.length - 1)];

      const value = val8 + (val16 - val8) * ratio;
      multipliers.push(value);
    }

    return multipliers;
  }

  static getMultipliers(lines: number, risk: string): number[] {
    const linesConfig =
      this.MULTIPLIERS[lines as keyof typeof this.MULTIPLIERS];
    if (linesConfig) {
      return (
        linesConfig[risk as keyof typeof linesConfig] ||
        this.generateMultipliersForLines(
          lines,
          risk as "low" | "medium" | "high",
        )
      );
    }
    if (lines >= 8 && lines <= 16) {
      return this.generateMultipliersForLines(
        lines,
        risk as "low" | "medium" | "high",
      );
    }
    return (
      this.MULTIPLIERS[16][risk as keyof (typeof this.MULTIPLIERS)[16]] || []
    );
  }

  static generateBallPath(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    linesCount: number,
  ): number[] {
    const path: number[] = [];

    for (let i = 0; i < linesCount; i++) {
      const combined = `${serverSeed}:${clientSeed}:${nonce}:${i}`;
      const hmac = crypto.createHmac("sha256", combined);
      hmac.update(combined);
      const hash = hmac.digest("hex");
      const direction = parseInt(hash.slice(0, 8), 16) % 2;
      path.push(direction);
    }

    return path;
  }

  static calculateSlotIndex(path: number[]): number {
    return path.reduce((sum, dir) => sum + dir, 0);
  }

  static async processDrop(
    userId: string,
    data: {
      amount: number;
      balls: number;
      risk: "low" | "medium" | "high";
      lines: number;
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { amount, balls, risk, lines } = data;
    const totalBet = amount * balls;

    if (amount < 0.1 || amount > 100) {
      throw HttpError(400, "Bet amount must be between 0.10 and 100");
    }

    if (![1, 2, 5, 10].includes(balls)) {
      throw HttpError(400, "Balls must be one of: 1, 2, 5, 10");
    }

    if (lines < 8 || lines > 16) {
      throw HttpError(400, "Lines must be between 8 and 16");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw HttpError(404, "User not found");
    }

    const oldBalance = user.balance;
    const oldTotalWagered = user.totalWagered;
    const oldGamesPlayed = user.gamesPlayed;

    if (user.balance < totalBet) {
      throw HttpError(400, "Insufficient balance");
    }

    if (!user.serverSeed)
      user.serverSeed = crypto.randomBytes(32).toString("hex");
    if (!user.clientSeed)
      user.clientSeed = crypto.randomBytes(12).toString("hex");
    if (user.nonce === undefined) user.nonce = 0;

    const serverSeed = user.serverSeed;
    const clientSeed = user.clientSeed;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          balance: { $gte: totalBet },
        },
        {
          $inc: {
            balance: -totalBet,
            totalWagered: totalBet,
            gamesPlayed: 1,
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        },
      );

      if (!updatedUser) {
        throw HttpError(400, "Insufficient balance or user not found");
      }

      const drop = await PlinkoDrop.create(
        [
          {
            userId,
            betAmount: amount,
            ballsCount: balls,
            riskLevel: risk,
            linesCount: lines,
          },
        ],
        { session },
      );

      const dropsResults = [];
      let totalWin = 0;
      let currentNonce = updatedUser.nonce || 0;

      for (let i = 0; i < balls; i++) {
        currentNonce += 1;

        const path = this.generateBallPath(
          serverSeed,
          clientSeed,
          currentNonce,
          lines,
        );
        const slotIndex = this.calculateSlotIndex(path);

        const multipliers = this.getMultipliers(lines, risk);
        if (!multipliers || multipliers.length === 0) {
          throw HttpError(
            400,
            `Invalid configuration: Lines ${lines}, Risk ${risk}`,
          );
        }

        const multiplier = multipliers[slotIndex];
        if (multiplier === undefined) {
          throw HttpError(
            500,
            `Invalid slot index ${slotIndex} for lines ${lines}`,
          );
        }

        const winAmount = amount * multiplier;
        totalWin += winAmount;

        dropsResults.push({
          dropId: drop[0]._id,
          ballIndex: i,
          path,
          slotIndex,
          multiplier,
          winAmount,
          serverSeed,
          clientSeed,
          nonce: currentNonce,
        });
      }

      const finalUser = await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            balance: totalWin,
            totalWon: totalWin > 0 ? totalWin : 0,
            nonce: balls,
          },
        },
        { session, new: true },
      );

      if (dropsResults.length > 0) {
        await PlinkoResult.insertMany(dropsResults, { session });
        const dropDoc = drop[0];
        dropDoc.completed = true;
        dropDoc.completedAt = new Date();
        dropDoc.status = totalWin >= totalBet ? "won" : "lost";
        await dropDoc.save({ session });
      }

      await session.commitTransaction();

      const isWin = totalWin > totalBet;
      const netWin = totalWin - totalBet;
      leaderboardService
        .updateStats(
          new mongoose.Types.ObjectId(userId),
          totalBet,
          netWin,
          isWin,
        )
        .catch((err) => {
          console.error("Leaderboard update failed", {
            userId: userId.toString(),
            error: err,
          });
        });

      auditService
        .log({
          userId: new mongoose.Types.ObjectId(userId),
          action: "BET",
          entityType: "PlinkoDrop",
          entityId: drop[0]._id,
          oldValue: {
            balance: oldBalance,
            totalWagered: oldTotalWagered,
            gamesPlayed: oldGamesPlayed,
          },
          newValue: {
            balance: finalUser?.balance || 0,
            totalWagered: oldTotalWagered + totalBet,
            gamesPlayed: oldGamesPlayed + 1,
            totalBet,
            totalWin,
            balls,
            risk,
            lines,
          },
          ipAddress,
          userAgent,
        })
        .catch((err) => {
          console.error("Audit log failed:", err);
        });

      return {
        drops: dropsResults.map((r) => ({
          dropId: r.dropId,
          path: r.path,
          slotIndex: r.slotIndex,
          multiplier: r.multiplier,
          winAmount: r.winAmount,
          serverSeed: r.serverSeed,
          clientSeed: r.clientSeed,
          nonce: r.nonce,
        })),
        totalBet,
        totalWin,
        newBalance: finalUser?.balance || 0,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async getHistory(userId: string, limit = 10, offset = 0) {
    const minCompletedAt = new Date(Date.now() - 10000);
    const drops = await PlinkoDrop.find({
      userId,
      completed: true,
      completedAt: { $lt: minCompletedAt },
    })
      .sort({ completedAt: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit);

    const dropsWithResults = await Promise.all(
      drops.map(async (drop) => {
        const results = await PlinkoResult.find({ dropId: drop._id });
        const totalWin = results.reduce((sum, r) => sum + r.winAmount, 0);
        const totalBet = drop.betAmount * drop.ballsCount;
        const avgMultiplier = totalBet > 0 ? totalWin / totalBet : 0;

        return {
          ...drop.toObject(),
          totalWin,
          avgMultiplier: avgMultiplier.toFixed(2),
          status: drop.status || (totalWin >= totalBet ? "won" : "lost"),
        };
      }),
    );

    return { drops: dropsWithResults };
  }
}

export const processDrop = PlinkoService.processDrop.bind(PlinkoService);
export const getMultipliersList =
  PlinkoService.getMultipliers.bind(PlinkoService);
export const getUserHistory = PlinkoService.getHistory.bind(PlinkoService);
export const getRecentDrops = async (limit = 20) => {
  const drops = await PlinkoDrop.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "username");
  return { drops };
};
