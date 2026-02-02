import { Document, Types } from "mongoose";

export interface IMinesGame extends Document {
  userId: Types.ObjectId;
  betAmount: number;
  gridSize: number;
  minesCount: number;
  minePositions: number[];
  revealedPositions: number[];
  status: "active" | "won" | "lost" | "cashed_out";
  cashoutMultiplier?: number;
  winAmount?: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: Date;
  finishedAt?: Date;
}

