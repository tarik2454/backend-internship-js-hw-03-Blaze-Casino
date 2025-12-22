import crypto from "crypto";
import { HydratedDocument } from "mongoose";
import { MinesGame } from "./mines.model";
import { IUser } from "../users/users.types";
import { HttpError } from "../../helpers";
import {
  generateMinePositions,
  calculateMultiplier,
  generateMultiplierTable,
  hashServerSeed,
} from "./mines.utils";

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

    user.balance -= amount;
    user.totalWagered += amount;
    user.gamesPlayed += 1;

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

    await user.save();

    const nonce = user.gamesPlayed;
    const currentClientSeed = user.clientSeed;

    const gameServerSeed = serverSeed;
    user.serverSeed = crypto.randomBytes(32).toString("hex");
    await user.save();

    const minePositions = generateMinePositions(
      gameServerSeed,
      currentClientSeed,
      nonce,
      minesCount
    );

    const serverSeedHash = hashServerSeed(gameServerSeed);

    const game = await MinesGame.create({
      userId: user._id,
      betAmount: amount,
      minesCount,
      minePositions,
      status: "active",
      serverSeed: gameServerSeed,
      serverSeedHash,
      clientSeed: currentClientSeed,
      nonce,
    });

    const multipliers = generateMultiplierTable(minesCount);

    return {
      gameId: game._id,
      amount,
      minesCount,
      serverSeedHash,
      multipliers,
    };
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
        game.status = "won";
        game.winAmount = currentValue;
        game.cashoutMultiplier = currentMultiplier;
        game.finishedAt = new Date();
        await game.save();

        user.balance += currentValue;
        user.totalWon += currentValue;
        await user.save();

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

    game.status = "won";
    game.winAmount = winAmount;
    game.cashoutMultiplier = currentMultiplier;
    game.finishedAt = new Date();
    await game.save();

    user.balance += winAmount;
    user.totalWon += winAmount;
    await user.save();

    return {
      winAmount,
      multiplier: currentMultiplier,
      serverSeed: game.serverSeed,
      minePositions: game.minePositions,
    };
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
