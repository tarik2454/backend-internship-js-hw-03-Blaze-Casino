import mongoose, { Schema, Model } from "mongoose";
import { IAuditLog } from "./audit-log.types";

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "BET",
        "CASHOUT",
        "REVEAL",
        "OPEN_CASE",
        "CLAIM_BONUS",
        "LOGIN",
        "LOGOUT",
        "REGISTER",
      ],
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        "User",
        "MinesGame",
        "PlinkoDrop",
        "CaseOpening",
        "BonusClaim",
        "LeaderboardStats",
        "CrashBet",
        "Crash",
      ],
    },
    entityId: {
      type: Schema.Types.Mixed,
    },
    oldValue: {
      type: Schema.Types.Mixed,
    },
    newValue: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true, versionKey: false }
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>(
  "AuditLog",
  auditLogSchema
);

