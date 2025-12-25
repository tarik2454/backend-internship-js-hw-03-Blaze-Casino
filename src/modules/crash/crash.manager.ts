import { Crash } from "./models/crash/crash.model";
import { CrashBet } from "./models/crash-bets/crash-bets.model";
import { ICrashBet } from "./models/crash-bets/crash-bets.types";
import crashWebSocketHandler from "./crash.ws.handler";
import {
  generateServerSeed,
  hashServerSeed,
  generateCrashPoint,
} from "./crash.utils";
import mongoose from "mongoose";

export enum CrashState {
  WAITING = "waiting",
  RUNNING = "running",
  CRASHED = "crashed",
}

interface GameState {
  state: CrashState;
  multiplier: number;
  startedAt: number | null;
  crashPoint: number;
  tickInterval: NodeJS.Timeout | null;
}

class CrashManager {
  private games: Map<string, GameState> = new Map();
  private TICK_RATE = 100;

  async createGameForUser(userId: string): Promise<string> {
    const activeBet = await CrashBet.findOne({
      userId,
      status: "active",
    });

    if (activeBet && activeBet.gameId) {
      const gameIdString =
        activeBet.gameId instanceof mongoose.Types.ObjectId
          ? activeBet.gameId.toString()
          : String(activeBet.gameId);

      const game = await Crash.findById(gameIdString);
      if (
        game &&
        (game.status === CrashState.WAITING ||
          game.status === CrashState.RUNNING)
      ) {
        if (!this.games.has(gameIdString)) {
          this.games.set(gameIdString, {
            state: game.status as CrashState,
            multiplier:
              game.status === CrashState.RUNNING && game.startedAt
                ? this.calculateMultiplier(
                    Date.now() - game.startedAt.getTime()
                  )
                : 1.0,
            startedAt: game.startedAt ? game.startedAt.getTime() : null,
            crashPoint: game.crashPoint,
            tickInterval: null,
          });
          if (game.status === CrashState.RUNNING && game.startedAt) {
            this.startTick(gameIdString);
          }
        }
        return gameIdString;
      }
    }

    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const clientSeed = generateServerSeed();
    const nonce = Math.floor(Math.random() * 1000000);
    const crashPoint = generateCrashPoint(serverSeed, clientSeed, nonce);

    const game = await Crash.create({
      crashPoint,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      status: CrashState.WAITING,
    });

    const gameId = game._id.toString();
    this.games.set(gameId, {
      state: CrashState.WAITING,
      multiplier: 1.0,
      startedAt: null,
      crashPoint,
      tickInterval: null,
    });

    return gameId;
  }

  async startGame(gameId: string): Promise<void> {
    const gameState = this.games.get(gameId);
    if (!gameState || gameState.state !== CrashState.WAITING) {
      return;
    }

    gameState.state = CrashState.RUNNING;
    gameState.startedAt = Date.now();

    await Crash.findByIdAndUpdate(gameId, {
      status: CrashState.RUNNING,
      startedAt: new Date(gameState.startedAt),
    });

    this.startTick(gameId);
  }

  private startTick(gameId: string): void {
    const gameState = this.games.get(gameId);
    if (!gameState) return;

    if (gameState.tickInterval) {
      clearTimeout(gameState.tickInterval);
    }

    const tickFn = async () => {
      const currentState = this.games.get(gameId);
      if (
        !currentState ||
        !currentState.startedAt ||
        currentState.state !== CrashState.RUNNING
      ) {
        return;
      }

      const elapsed = Date.now() - currentState.startedAt;
      currentState.multiplier = this.calculateMultiplier(elapsed);

      if (currentState.multiplier >= currentState.crashPoint) {
        await this.crash(gameId);
        return;
      }

      crashWebSocketHandler.emitGameTick(
        gameId,
        currentState.multiplier,
        elapsed
      );
      await this.checkAutoCashout(gameId);

      currentState.tickInterval = setTimeout(tickFn, this.TICK_RATE);
      this.games.set(gameId, currentState);
    };

    gameState.tickInterval = setTimeout(tickFn, this.TICK_RATE);
    this.games.set(gameId, gameState);
  }

  private calculateMultiplier(elapsedMs: number): number {
    const multiplier = Math.pow(1.0024, elapsedMs / 100);
    return Math.floor(multiplier * 100) / 100;
  }

  private async checkAutoCashout(gameId: string): Promise<void> {
    const betsToCashout = await CrashBet.find({
      gameId,
      status: "active",
      autoCashout: { $lte: this.games.get(gameId)?.multiplier || 0, $ne: null },
    });

    for (const bet of betsToCashout) {
      try {
        if (bet.autoCashout === undefined) {
          continue;
        }
        await this.processCashout(bet, bet.autoCashout);
      } catch (error) {}
    }
  }

  private async processCashout(
    bet: ICrashBet,
    multiplier: number
  ): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const winAmount = Math.round(bet.amount * multiplier * 100) / 100;

      await CrashBet.findByIdAndUpdate(
        bet._id,
        {
          $set: {
            cashoutMultiplier: multiplier,
            winAmount,
            status: "won",
          },
        },
        { session }
      );

      await mongoose.model("User").findByIdAndUpdate(
        bet.userId,
        {
          $inc: {
            balance: winAmount,
            totalWon: winAmount,
          },
        },
        { session }
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  private async crash(gameId: string): Promise<void> {
    const gameState = this.games.get(gameId);
    if (!gameState) return;

    if (gameState.tickInterval) {
      clearTimeout(gameState.tickInterval);
    }

    gameState.state = CrashState.CRASHED;

    const game = await Crash.findById(gameId);
    if (!game) return;

    await Crash.findByIdAndUpdate(gameId, {
      status: CrashState.CRASHED,
      crashedAt: new Date(),
    });

    await CrashBet.updateMany(
      { gameId, status: "active" },
      { $set: { status: "lost" } }
    );

    crashWebSocketHandler.emitGameCrash(
      gameId,
      gameState.crashPoint,
      game.serverSeed,
      game.serverSeed
    );

    this.games.delete(gameId);
  }

  async stopGame(gameId: string): Promise<void> {
    const gameState = this.games.get(gameId);
    if (!gameState) return;

    if (gameState.tickInterval) {
      clearTimeout(gameState.tickInterval);
    }

    const activeBets = await CrashBet.find({
      gameId,
      status: "active",
    });

    for (const bet of activeBets) {
      await mongoose.model("User").findByIdAndUpdate(bet.userId, {
        $inc: { balance: bet.amount },
      });
    }

    await CrashBet.updateMany(
      { gameId, status: "active" },
      { $set: { status: "lost" } }
    );

    await Crash.findByIdAndUpdate(gameId, {
      status: CrashState.CRASHED,
      crashedAt: new Date(),
    });

    const game = await Crash.findById(gameId);
    if (game) {
      crashWebSocketHandler.emitGameCrash(
        gameId,
        gameState.crashPoint || 1.0,
        game.serverSeed,
        game.serverSeed
      );
    }

    this.games.delete(gameId);
  }

  async getOrCalculateMultiplier(
    gameId: string,
    startedAt: Date
  ): Promise<number | null> {
    const gameState = this.games.get(gameId);
    if (
      gameState &&
      gameState.state === CrashState.RUNNING &&
      gameState.startedAt
    ) {
      return gameState.multiplier;
    }

    if (!startedAt) {
      return null;
    }

    const elapsed = Math.max(0, Date.now() - startedAt.getTime());
    return this.calculateMultiplier(elapsed);
  }
}

export default new CrashManager();
