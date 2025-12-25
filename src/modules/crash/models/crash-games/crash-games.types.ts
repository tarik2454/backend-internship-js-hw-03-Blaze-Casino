import { Document } from "mongoose";

export interface ICrashGame extends Document {
  crashPoint: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  status: "waiting" | "running" | "crashed";
  startedAt?: Date;
  crashedAt?: Date;
  createdAt: Date;
}
