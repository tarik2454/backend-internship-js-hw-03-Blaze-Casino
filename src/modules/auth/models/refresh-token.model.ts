import { Schema, model } from "mongoose";
import { IRefreshToken } from "./refresh-token.types";

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    sessionStart: { type: Date, required: true },
  },
  { versionKey: false, timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema
);
