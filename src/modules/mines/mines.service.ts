import crypto from "crypto";
import mongoose, { HydratedDocument } from "mongoose";
import { MinesGame } from "./models/mines.model";
import { IUser } from "../users/models/users.types";
import { HttpError } from "../../helpers";
import {
  generateMinePositions,
  calculateMultiplier,
  generateMultiplierTable,
  hashServerSeed,
} from "./mines.utils";
import leaderboardService from "../leaderboard/leaderboard.service";

class MinesService {
  async startMine(
    user: HydratedDocument<IUser>,
    amount: number,
    minesCount: number,
    clientSeed?: string
  ) {
    const activeGame = await MinesGame.findOne({
      userId: user._id,
      status: "active",
    });

    if (activeGame) {
      throw HttpError(400, "You already have an active game");
    }

    if (user.balance < amount) {
      throw HttpError(400, "Insufficient balance");
    }

    let serverSeed = user.serverSeed;
    if (!serverSeed) {
      serverSeed = crypto.randomBytes(32).toString("hex");
      user.serverSeed = serverSeed;
    }

    if (clientSeed) {
      user.clientSeed = clientSeed;
    } else if (!user.clientSeed) {
      user.clientSeed = crypto.randomBytes(16).toString("hex");
    }

    const nonce = user.gamesPlayed;
    const currentClientSeed = user.clientSeed;
    const gameServerSeed = serverSeed;

    const minePositions = generateMinePositions(
      gameServerSeed,
      currentClientSeed,
      nonce,
      minesCount
    );

    const serverSeedHash = hashServerSeed(gameServerSeed);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      user.balance -= amount;
      user.totalWagered += amount;
      user.gamesPlayed += 1;
      user.serverSeed = crypto.randomBytes(32).toString("hex");

      await user.save({ session });

      const game = await MinesGame.create(
        [
          {
            userId: user._id,
            betAmount: amount,
            minesCount,
            minePositions,
            status: "active",
            serverSeed: gameServerSeed,
            serverSeedHash,
            clientSeed: currentClientSeed,
            nonce,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      const multipliers = generateMultiplierTable(minesCount);

      return {
        gameId: game[0]._id,
        amount,
        minesCount,
        serverSeedHash,
        multipliers,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async revealMine(
    user: HydratedDocument<IUser>,
    gameId: string,
    position: number
  ) {
    const game = await MinesGame.findOne({
      _id: gameId,
      userId: user._id,
    });

    if (!game) {
      throw HttpError(404, "Game not found");
    }

    if (game.status !== "active") {
      throw HttpError(400, "Game is not active");
    }

    if (game.revealedPositions.includes(position)) {
      throw HttpError(400, "Position already revealed");
    }

    const isMine = game.minePositions.includes(position);

    if (isMine) {
      game.status = "lost";
      game.revealedPositions.push(position);
      game.finishedAt = new Date();
      await game.save();

      const isWin = false;
      const netWin = -game.betAmount;
      leaderboardService
        .updateStats(user._id, game.betAmount, netWin, isWin)
        .catch((err) => {
          console.error("Leaderboard update failed", {
            userId: user._id.toString(),
            error: err,
          });
        });

      return {
        position,
        isMine: true,
        currentMultiplier: 0,
        currentValue: 0,
        revealedTiles: game.revealedPositions,
        safeTilesLeft: 0,
        minePositions: game.minePositions,
      };
    } else {
      game.revealedPositions.push(position);

      const safeTilesTotal = 25 - game.minesCount;
      const safeTilesLeft = safeTilesTotal - game.revealedPositions.length;

      const currentMultiplier = calculateMultiplier(
        game.minesCount,
        game.revealedPositions.length
      );

      const currentValue =
        Math.floor(game.betAmount * currentMultiplier * 100) / 100;

      if (safeTilesLeft === 0) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          game.status = "won";
          game.winAmount = currentValue;
          game.cashoutMultiplier = currentMultiplier;
          game.finishedAt = new Date();
          await game.save({ session });

          user.balance += currentValue;
          user.totalWon += currentValue;
          await user.save({ session });

          await session.commitTransaction();

          const isWin = true;
          const netWin = currentValue - game.betAmount;
          leaderboardService
            .updateStats(user._id, game.betAmount, netWin, isWin)
            .catch((err) => {
              console.error("Leaderboard update failed", {
                userId: user._id.toString(),
                error: err,
              });
            });

          return {
            position,
            isMine: false,
            currentMultiplier,
            currentValue,
            revealedTiles: game.revealedPositions,
            safeTilesLeft,
            status: "won",
            winAmount: currentValue,
          };
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }

      await game.save();

      return {
        position,
        isMine: false,
        currentMultiplier,
        currentValue,
        revealedTiles: game.revealedPositions,
        safeTilesLeft,
      };
    }
  }

  async cashoutMine(user: HydratedDocument<IUser>, gameId: string) {
    const game = await MinesGame.findOne({
      _id: gameId,
      userId: user._id,
    });

    if (!game) {
      throw HttpError(404, "Game not found");
    }

    if (game.status !== "active") {
      throw HttpError(400, "Game is not active");
    }

    if (game.revealedPositions.length === 0) {
      throw HttpError(400, "Cannot cashout without revealing any tiles");
    }

    const currentMultiplier = calculateMultiplier(
      game.minesCount,
      game.revealedPositions.length
    );
    const winAmount =
      Math.floor(game.betAmount * currentMultiplier * 100) / 100;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      game.status = "won";
      game.winAmount = winAmount;
      game.cashoutMultiplier = currentMultiplier;
      game.finishedAt = new Date();
      await game.save({ session });

      user.balance += winAmount;
      user.totalWon += winAmount;
      await user.save({ session });

      await session.commitTransaction();

      const isWin = true;
      const netWin = winAmount - game.betAmount;
      leaderboardService
        .updateStats(user._id, game.betAmount, netWin, isWin)
        .catch((err) => {
          console.error("Leaderboard update failed", {
            userId: user._id.toString(),
            error: err,
          });
        });

      return {
        winAmount,
        multiplier: currentMultiplier,
        serverSeed: game.serverSeed,
        minePositions: game.minePositions,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getActiveGame(user: HydratedDocument<IUser>) {
    const game = await MinesGame.findOne({
      userId: user._id,
      status: "active",
    });

    return { game: game || null };
  }

  async getHistory(user: HydratedDocument<IUser>, limit = 10, offset = 0) {
    const games = await MinesGame.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    return { games };
  }
}

export default new MinesService();
