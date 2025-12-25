import { Server as SocketIOServer } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import {
  GameStartEvent,
  GameTickEvent,
  GameCrashEvent,
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
      console.log(`[Crash WS] Client connected: ${socket.id}`);

      socket.on("bet:place", async (data: BetPlaceEvent) => {
        console.log(`[Crash WS] bet:place received from ${socket.id}:`, data);
      });

      socket.on("bet:cashout", async (data: BetCashoutEvent) => {
        console.log(`[Crash WS] bet:cashout received from ${socket.id}:`, data);
      });

      socket.on("disconnect", () => {
        console.log(`[Crash WS] Client disconnected: ${socket.id}`);
      });
    });
  }

  emitGameStart(gameId: string, serverSeedHash: string): void {
    if (!this.io) return;
    const event: GameStartEvent = { gameId, serverSeedHash };
    this.io.of("/crash").emit("game:start", event);
  }

  emitGameTick(multiplier: number, elapsed: number): void {
    if (!this.io) return;
    const event: GameTickEvent = { multiplier, elapsed };
    this.io.of("/crash").emit("game:tick", event);
  }

  emitGameCrash(crashPoint: number, serverSeed: string, reveal: string): void {
    if (!this.io) return;
    const event: GameCrashEvent = { crashPoint, serverSeed, reveal };
    this.io.of("/crash").emit("game:crash", event);
  }
}

export default new CrashWebSocketHandler();
