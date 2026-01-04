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

let ioRef: SocketIOServerType | null = null;

export function initializeCrashHandler(io: SocketIOServerType): void {
  ioRef = io;

  const crashNamespace = ioRef.of("/crash");

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

export function emitGameTick(
  gameId: string,
  multiplier: number,
  elapsed: number
): void {
  if (!ioRef) return;
  const event: GameTickEvent = { gameId, multiplier, elapsed };
  ioRef.of("/crash").to(`game:${gameId}`).emit("game:tick", event);
}

export function emitGameCrash(
  gameId: string,
  crashPoint: number,
  serverSeed: string,
  reveal: string
): void {
  if (!ioRef) return;
  const event: GameCrashEvent = { gameId, crashPoint, serverSeed, reveal };
  ioRef.of("/crash").to(`game:${gameId}`).emit("game:crash", event);
}
