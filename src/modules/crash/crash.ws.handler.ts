import { Server as SocketIOServer } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import {
  GameStartEvent,
  GameTickEvent,
  GameCrashEvent,
  PlayerBetEvent,
  PlayerCashoutEvent,
  BetPlaceEvent,
  BetCashoutEvent,
} from "./crash.ws.types";

type SocketIOServerType = SocketIOServer<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  unknown
>;

class CrashWebSocketHandler {
  private io: SocketIOServerType | null = null;

  initialize(io: SocketIOServerType): void {
    this.io = io;
    this.setupCrashNamespace();
  }

  private setupCrashNamespace(): void {
    if (!this.io) return;

    const crashNamespace = this.io.of("/crash");

    crashNamespace.on("connection", (socket) => {
      console.log("Client connected to crash namespace:", socket.id);

      // Client → Server: bet:place
      socket.on("bet:place", async (data: BetPlaceEvent) => {
        try {
          // This allows multiple tabs to sync their bet state
          console.log("bet:place received via socket", data);
        } catch (error) {
          console.error("Socket bet:place error:", error);
        }
      });

      // Client → Server: bet:cashout
      socket.on("bet:cashout", async (data: BetCashoutEvent) => {
        try {
          console.log("bet:cashout received via socket", data);
        } catch (error) {
          console.error("Socket bet:cashout error:", error);
        }
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected from crash namespace:", socket.id);
      });
    });
  }

  // Server → Client: game:start
  emitGameStart(gameId: string, serverSeedHash: string): void {
    if (!this.io) return;
    const event: GameStartEvent = { gameId, serverSeedHash };
    this.io.of("/crash").emit("game:start", event);
  }

  // Server → Client: game:tick
  emitGameTick(multiplier: number, elapsed: number): void {
    if (!this.io) return;
    const event: GameTickEvent = { multiplier, elapsed };
    this.io.of("/crash").emit("game:tick", event);
  }

  // Server → Client: game:crash
  emitGameCrash(crashPoint: number, serverSeed: string, reveal: string): void {
    if (!this.io) return;
    const event: GameCrashEvent = { crashPoint, serverSeed, reveal };
    this.io.of("/crash").emit("game:crash", event);
  }

  // Server → Client: player:bet
  emitPlayerBet(userId: string, userName: string, amount: number): void {
    if (!this.io) return;
    const event: PlayerBetEvent = { userId, userName, amount };
    this.io.of("/crash").emit("player:bet", event);
  }

  // Server → Client: player:cashout
  emitPlayerCashout(
    userId: string,
    multiplier: number,
    winAmount: number
  ): void {
    if (!this.io) return;
    const event: PlayerCashoutEvent = { userId, multiplier, winAmount };
    this.io.of("/crash").emit("player:cashout", event);
  }
}

export default new CrashWebSocketHandler();
