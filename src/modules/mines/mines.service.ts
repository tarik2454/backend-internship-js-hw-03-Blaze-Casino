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
import auditService from "../audit/audit.service";

class MinesService {
  async startMine(
    user: HydratedDocument<IUser>,
    amount: number,
    minesCount: number,
    clientSeed?: string,
    gridSize = 5,
    ipAddress?: string,
    userAgent?: string
  ) {
    const activeGame = await MinesGame.findOne({
      userId: user._id,
      status: "active",
    });

    if (activeGame) {
      throw HttpError(400, "You already have an active game");
    }

    if (amount < 0.1 || amount > 10000) {
      throw HttpError(400, "Bet amount must be between 0.10 and 10000");
    }

    if (gridSize < 5 || gridSize > 8) {
      throw HttpError(400, "Grid size must be 5, 6, 7, or 8");
    }

    const totalTiles = gridSize * gridSize;
    if (minesCount < 1 || minesCount >= totalTiles) {
      throw HttpError(
        400,
        `Mines count must be between 1 and ${totalTiles - 1} for grid ${gridSize}x${gridSize}`
      );
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
      minesCount,
      totalTiles
    );

    const serverSeedHash = hashServerSeed(gameServerSeed);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
          $set: {
            serverSeed: crypto.randomBytes(32).toString("hex"),
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        }
      );

      if (!updatedUser) {
        throw HttpError(400, "Insufficient balance or user not found");
      }

      const activeGameInTx = await MinesGame.findOne(
        {
          userId: user._id,
          status: "active",
        },
        null,
        { session }
      );

      if (activeGameInTx) {
        throw HttpError(400, "You already have an active game");
      }

      const game = await MinesGame.create(
        [
          {
            userId: user._id,
            betAmount: amount,
            gridSize,
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

      auditService
        .log({
          userId: user._id,
          action: "BET",
          entityType: "MinesGame",
          entityId: game[0]._id,
          oldValue: {
            balance: user.balance + amount,
            totalWagered: user.totalWagered - amount,
            gamesPlayed: user.gamesPlayed - 1,
          },
          newValue: {
            balance: updatedUser.balance,
            totalWagered: updatedUser.totalWagered,
            gamesPlayed: updatedUser.gamesPlayed,
            gameId: game[0]._id.toString(),
            betAmount: amount,
            minesCount,
            gridSize,
          },
          ipAddress,
          userAgent,
        })
        .catch((err) => {
          console.error("Audit log failed:", err);
        });

      const multipliers = generateMultiplierTable(minesCount, totalTiles);

      return {
        gameId: game[0]._id,
        amount,
        minesCount,
        gridSize,
        totalTiles,
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
    position: number,
    ipAddress?: string,
    userAgent?: string
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const existingGame = await MinesGame.findOne({
        _id: gameId,
        userId: user._id,
        status: "active",
      }).session(session);

      if (!existingGame) {
        throw HttpError(
          400,
          "Game not found, not active, or position already revealed"
        );
      }

      const totalTiles = existingGame.gridSize * existingGame.gridSize;
      if (position < 0 || position >= totalTiles) {
        throw HttpError(
          400,
          `Position must be between 0 and ${totalTiles - 1} for this grid`
        );
      }

      const game = await MinesGame.findOneAndUpdate(
        {
          _id: gameId,
          userId: user._id,
          status: "active",
          revealedPositions: { $ne: position },
        },
        {
          $addToSet: { revealedPositions: position },
        },
        {
          session,
          new: true,
        }
      );

      if (!game) {
        throw HttpError(
          400,
          "Game not found, not active, or position already revealed"
        );
      }

      const isMine = game.minePositions.includes(position);

      if (isMine) {
        await MinesGame.findByIdAndUpdate(
          gameId,
          {
            $set: {
              status: "lost",
              finishedAt: new Date(),
            },
          },
          { session }
        );

        await session.commitTransaction();

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

        auditService
          .log({
            userId: user._id,
            action: "REVEAL",
            entityType: "MinesGame",
            entityId: gameId,
            oldValue: {
              status: "active",
              revealedPositions: game.revealedPositions.filter(
                (p) => p !== position
              ),
            },
            newValue: {
              status: "lost",
              revealedPositions: game.revealedPositions,
              position,
              isMine: true,
            },
            ipAddress,
            userAgent,
          })
          .catch((err) => {
            console.error("Audit log failed:", err);
          });

        return {
          position,
          isMine: true,
          currentMultiplier: 0,
          currentValue: 0,
          revealedTiles: game.revealedPositions,
          safeTilesLeft: 0,
          minePositions: game.minePositions,
          gridSize: game.gridSize,
          totalTiles: game.gridSize * game.gridSize,
        };
      } else {
        const totalTilesReveal = game.gridSize * game.gridSize;
        const safeTilesTotal = totalTilesReveal - game.minesCount;
        const safeTilesLeft = safeTilesTotal - game.revealedPositions.length;

        const currentMultiplier = calculateMultiplier(
          game.minesCount,
          game.revealedPositions.length,
          0.04,
          totalTilesReveal
        );

        const currentValue =
          Math.floor(game.betAmount * currentMultiplier * 100) / 100;

        if (safeTilesLeft === 0) {
          await MinesGame.findByIdAndUpdate(
            gameId,
            {
              $set: {
                status: "won",
                winAmount: currentValue,
                cashoutMultiplier: currentMultiplier,
                finishedAt: new Date(),
              },
            },
            { session }
          );

          await mongoose.model("User").findByIdAndUpdate(
            user._id,
            {
              $inc: {
                balance: currentValue,
                totalWon: currentValue,
              },
            },
            { session }
          );

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

          auditService
            .log({
              userId: user._id,
              action: "REVEAL",
              entityType: "MinesGame",
              entityId: gameId,
              oldValue: {
                status: "active",
                revealedPositions: game.revealedPositions.filter(
                  (p) => p !== position
                ),
              },
              newValue: {
                status: "won",
                revealedPositions: game.revealedPositions,
                position,
                isMine: false,
                winAmount: currentValue,
                multiplier: currentMultiplier,
              },
              ipAddress,
              userAgent,
            })
            .catch((err) => {
              console.error("Audit log failed:", err);
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
            gridSize: game.gridSize,
            totalTiles: totalTilesReveal,
          };
        }

        await session.commitTransaction();

        auditService
          .log({
            userId: user._id,
            action: "REVEAL",
            entityType: "MinesGame",
            entityId: gameId,
            oldValue: {
              revealedPositions: game.revealedPositions.filter(
                (p) => p !== position
              ),
            },
            newValue: {
              revealedPositions: game.revealedPositions,
              position,
              isMine: false,
              currentMultiplier,
              currentValue,
            },
            ipAddress,
            userAgent,
          })
          .catch((err) => {
            console.error("Audit log failed:", err);
          });

        return {
          position,
          isMine: false,
          currentMultiplier,
          currentValue,
          revealedTiles: game.revealedPositions,
          safeTilesLeft,
          gridSize: game.gridSize,
          totalTiles: totalTilesReveal,
        };
      }
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async cashoutMine(
    user: HydratedDocument<IUser>,
    gameId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const game = await MinesGame.findOneAndUpdate(
        {
          _id: gameId,
          userId: user._id,
          status: "active",
        },
        {
          $set: {
            status: "cashed_out",
            finishedAt: new Date(),
          },
        },
        {
          session,
          new: true,
        }
      );

      if (!game) {
        throw HttpError(404, "Game not found or not active");
      }

      if (game.revealedPositions.length === 0) {
        throw HttpError(400, "Cannot cashout without revealing any tiles");
      }

      const totalTilesCashout = game.gridSize * game.gridSize;
      const currentMultiplier = calculateMultiplier(
        game.minesCount,
        game.revealedPositions.length,
        0.04,
        totalTilesCashout
      );
      const winAmount =
        Math.floor(game.betAmount * currentMultiplier * 100) / 100;

      await MinesGame.findByIdAndUpdate(
        gameId,
        {
          $set: {
            winAmount: winAmount,
            cashoutMultiplier: currentMultiplier,
          },
        },
        { session }
      );

      await mongoose.model("User").findByIdAndUpdate(
        user._id,
        {
          $inc: {
            balance: winAmount,
            totalWon: winAmount,
          },
        },
        { session }
      );

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

      auditService
        .log({
          userId: user._id,
          action: "CASHOUT",
          entityType: "MinesGame",
          entityId: gameId,
          oldValue: {
            status: "active",
            balance: user.balance - winAmount,
            totalWon: user.totalWon - winAmount,
          },
          newValue: {
            status: "cashed_out",
            winAmount,
            multiplier: currentMultiplier,
            revealedPositions: game.revealedPositions,
          },
          ipAddress,
          userAgent,
        })
        .catch((err) => {
          console.error("Audit log failed:", err);
        });

      return {
        winAmount,
        multiplier: currentMultiplier,
        serverSeed: game.serverSeed,
        minePositions: game.minePositions,
        gridSize: game.gridSize,
        totalTiles: totalTilesCashout,
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
    const games = await MinesGame.find({
      userId: user._id,
      status: { $in: ["won", "lost", "cashed_out"] },
    })
      .sort({ finishedAt: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit);

    return { games };
  }
}

export default new MinesService();
