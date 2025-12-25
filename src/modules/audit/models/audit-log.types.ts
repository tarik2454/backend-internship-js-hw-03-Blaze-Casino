import { Document, Types } from "mongoose";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "BET"
  | "CASHOUT"
  | "REVEAL"
  | "OPEN_CASE"
  | "CLAIM_BONUS"
  | "LOGIN"
  | "LOGOUT"
  | "REGISTER";

export type EntityType =
  | "User"
  | "MinesGame"
  | "PlinkoDrop"
  | "CaseOpening"
  | "BonusClaim"
  | "LeaderboardStats"
  | "CrashBet"
  | "Crash";

export interface IAuditLog extends Document {
  userId?: Types.ObjectId;
  action: AuditAction;
  entityType: EntityType;
  entityId?: Types.ObjectId | string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

