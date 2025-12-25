import mongoose, { HydratedDocument, Types } from "mongoose";
import { IUser } from "../users/models/users.types";
import {
  BetCrashResponse,
  CashoutCrashResponse,
  GetCrashHistoryResponse,
  GetCurrentCrashResponse,
  GetBetHistoryResponse,
  CrashBetHistory,
} from "./crash.types";
import { HttpError } from "../../helpers";
import { CrashGame } from "./models/crash-games/crash-games.model";
import { CrashBet } from "./models/crash-bets/crash-bets.model";
import { ICrashGame } from "./models/crash-games/crash-games.types";
import auditService from "../audit/audit.service";
import crashManager, { CrashState } from "./crash.manager";

class CrashService {
  async betCrash(
    user: HydratedDocument<IUser>,
    amount: number,
    autoCashout?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<BetCrashResponse> {
    if (amount < 0.1 || amount > 10000) {
      throw HttpError(400, "Bet amount must be between 0.10 and 10000");
    }

    if (
      autoCashout !== undefined &&
      (autoCashout < 1.0 || autoCashout > 1000)
    ) {
      throw HttpError(
        400,
        "Auto cashout multiplier must be between 1.00 and 1000"
      );
    }

    let currentGame = await CrashGame.findOne({
      status: { $in: ["waiting", "running"] },
    }).sort({ createdAt: -1 });

    if (!currentGame) {
      await crashManager.createAndStartGame();
      await new Promise((resolve) => setTimeout(resolve, 100));
      currentGame = await CrashGame.findOne({
        status: { $in: ["waiting", "running"] },
      }).sort({ createdAt: -1 });

      if (!currentGame) {
        throw HttpError(503, "Failed to create game. Please try again.");
      }
    }

    if (currentGame.status !== "waiting") {
      throw HttpError(400, "Bets can only be placed during the waiting phase");
    }

    const existingBet = await CrashBet.findOne({
      gameId: currentGame._id,
      userId: user._id,
      status: "active",
    });

    if (existingBet) {
      throw HttpError(400, "You already have an active bet in this game");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const oldBalance = user.balance;
      const oldTotalWagered = user.totalWagered || 0;

      const updatedUser = await mongoose.model("User").findOneAndUpdate(
        {
          _id: user._id,
          balance: { $gte: amount },
        },
        {
          $inc: {
            balance: -amount,
            totalWagered: amount,
            gamesPlayed: 1,
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        }
      );

      if (!updatedUser) {
        throw HttpError(400, "Insufficient balance");
      }

      const bet = await CrashBet.create(
        [
          {
            gameId: currentGame._id,
            userId: user._id,
            amount,
            autoCashout,
            status: "active",
          },
        ],
        { session }
      );

      await session.commitTransaction();

      if (currentGame.status === "waiting") {
        await crashManager.startCurrentGame();
      }

      auditService
        .log({
          userId: user._id,
          action: "BET",
          entityType: "CrashBet" as const,
          entityId: bet[0]._id,
          oldValue: {
            balance: oldBalance,
            totalWagered: oldTotalWagered,
            gamesPlayed: (user.gamesPlayed || 0) - 1,
          },
          newValue: {
            balance: updatedUser.balance,
            totalWagered: updatedUser.totalWagered,
            gamesPlayed: updatedUser.gamesPlayed,
            gameId: currentGame._id.toString(),
            betId: bet[0]._id.toString(),
            amount,
            autoCashout,
          },
          ipAddress,
          userAgent,
        })
        .catch(() => undefined);

      return {
        betId: bet[0]._id.toString(),
        amount,
        gameId: currentGame._id.toString(),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async cashoutCrash(
    user: HydratedDocument<IUser>,
    betId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CashoutCrashResponse> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const bet = await CrashBet.findOne({
        _id: betId,
        userId: user._id,
        status: "active",
      }).session(session);

      if (!bet) {
        throw HttpError(404, "Active bet not found");
      }

      const game = await CrashGame.findById(bet.gameId).session(session);

      if (!game) {
        throw HttpError(404, "Game not found");
      }

      let currentMultiplier: number;

      if (game.status === "running") {
        let multiplier = await this.getCurrentMultiplier(game);

        if (!multiplier && game.startedAt) {
          const elapsed = Math.max(0, Date.now() - game.startedAt.getTime());
          multiplier = Math.pow(1.0024, elapsed / 100);
          multiplier = Math.max(1.0, Math.floor(multiplier * 100) / 100);
        }

        if (!multiplier || multiplier < 1.0) {
          throw HttpError(400, "Invalid multiplier");
        }
        currentMultiplier = multiplier;
      } else if (game.status === "waiting") {
        currentMultiplier = 1.0;
      } else {
        throw HttpError(400, "Game is not active");
      }

      const winAmount = Math.round(bet.amount * currentMultiplier * 100) / 100;
      const oldBalance = user.balance;
      const oldTotalWon = user.totalWon || 0;

      const updatedBet = await CrashBet.findByIdAndUpdate(
        bet._id,
        {
          $set: {
            cashoutMultiplier: currentMultiplier,
            winAmount,
            status: "won",
          },
        },
        {
          session,
          new: true,
        }
      );

      if (!updatedBet) {
        throw HttpError(500, "Failed to update bet");
      }

      const updatedUser = await mongoose.model("User").findOneAndUpdate(
        {
          _id: user._id,
        },
        {
          $inc: {
            balance: winAmount,
            totalWon: winAmount,
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        }
      );

      if (!updatedUser) {
        throw HttpError(500, "Failed to update user balance");
      }

      await session.commitTransaction();

      await crashManager.stopCurrentGame();

      auditService
        .log({
          userId: user._id,
          action: "CASHOUT",
          entityType: "CrashBet" as const,
          entityId: bet._id,
          oldValue: {
            balance: oldBalance,
            totalWon: oldTotalWon,
            status: "active",
          },
          newValue: {
            balance: updatedUser.balance,
            totalWon: updatedUser.totalWon,
            status: "won",
            multiplier: currentMultiplier,
            winAmount,
          },
          ipAddress,
          userAgent,
        })
        .catch(() => undefined);

      return {
        multiplier: currentMultiplier,
        winAmount,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  private async getCurrentMultiplier(game: ICrashGame): Promise<number | null> {
    const managerState = crashManager.getState();
    if (
      managerState.gameId === game._id.toString() &&
      managerState.state === CrashState.RUNNING
    ) {
      return managerState.multiplier;
    }

    if (game.status !== "running" || !game.startedAt) {
      return null;
    }

    const elapsed = Math.max(0, Date.now() - game.startedAt.getTime());
    const multiplier = Math.pow(1.0024, elapsed / 100);
    return Math.max(1.0, Math.floor(multiplier * 100) / 100);
  }

  async getCrashHistory(
    _user: HydratedDocument<IUser>,
    limit: number,
    offset: number
  ): Promise<GetCrashHistoryResponse> {
    const games = await CrashGame.find({
      status: "crashed",
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .select("_id crashPoint serverSeedHash serverSeed")
      .lean();

    return {
      games: games.map((game) => ({
        gameId: game._id.toString(),
        crashPoint: game.crashPoint,
        hash: game.serverSeedHash,
        seed: game.serverSeed,
      })),
    };
  }

  async getCurrentCrash(
    user?: HydratedDocument<IUser>
  ): Promise<GetCurrentCrashResponse> {
    let currentGame = await CrashGame.findOne({
      status: { $in: ["waiting", "running"] },
    }).sort({ createdAt: -1 });

    if (!currentGame) {
      await crashManager.createAndStartGame();
      await new Promise((resolve) => setTimeout(resolve, 100));
      currentGame = await CrashGame.findOne({
        status: { $in: ["waiting", "running"] },
      }).sort({ createdAt: -1 });

      if (!currentGame) {
        throw HttpError(503, "Failed to create game. Please try again.");
      }
    }

    let multiplier: number | undefined;
    if (currentGame.status === "running" && currentGame.startedAt) {
      multiplier = (await this.getCurrentMultiplier(currentGame)) || undefined;
    }

    let myBet: { betId: string; amount: number } | undefined;
    if (user) {
      const userBet = await CrashBet.findOne({
        gameId: currentGame._id,
        userId: user._id,
        status: "active",
      });

      if (userBet) {
        myBet = {
          betId: userBet._id.toString(),
          amount: userBet.amount,
        };
      }
    }

    return {
      gameId: currentGame._id.toString(),
      state: currentGame.status,
      multiplier,
      serverSeedHash: currentGame.serverSeedHash,
      bets: [],
      myBet,
    };
  }

  async getUserBetHistory(
    user: HydratedDocument<IUser>,
    limit: number,
    offset: number
  ): Promise<GetBetHistoryResponse> {
    const bets = await CrashBet.find({
      userId: user._id,
      status: { $in: ["won", "lost"] },
    })
      .populate("gameId", "crashPoint")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    const betsHistory: CrashBetHistory[] = bets.map((bet) => {
      const game = bet.gameId as unknown;
      let crashPoint = 0;

      if (game && typeof game === "object" && "crashPoint" in game) {
        crashPoint = (game as { crashPoint: number }).crashPoint;
      }

      return {
        betId: bet._id.toString(),
        gameId:
          bet.gameId instanceof Types.ObjectId
            ? bet.gameId.toString()
            : typeof bet.gameId === "object" &&
              bet.gameId !== null &&
              "_id" in bet.gameId
            ? String((bet.gameId as { _id: unknown })._id)
            : String(bet.gameId),
        amount: bet.amount,
        cashoutMultiplier: bet.cashoutMultiplier,
        winAmount: bet.winAmount,
        status: bet.status as "won" | "lost",
        crashPoint,
        createdAt: bet.createdAt,
      };
    });

    return {
      bets: betsHistory,
    };
  }
}

export default new CrashService();
