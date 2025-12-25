import { Server as SocketIOServer } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import {
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

      socket.on("subscribe:game", (data: { gameId: string }) => {
        socket.join(`game:${data.gameId}`);
      });

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

  emitGameTick(gameId: string, multiplier: number, elapsed: number): void {
    if (!this.io) return;
    const event: GameTickEvent = { gameId, multiplier, elapsed };
    this.io.of("/crash").to(`game:${gameId}`).emit("game:tick", event);
  }

  emitGameCrash(
    gameId: string,
    crashPoint: number,
    serverSeed: string,
    reveal: string
  ): void {
    if (!this.io) return;
    const event: GameCrashEvent = { gameId, crashPoint, serverSeed, reveal };
    this.io.of("/crash").to(`game:${gameId}`).emit("game:crash", event);
  }
}

export default new CrashWebSocketHandler();
