import { Schema, model } from "mongoose";
import { ICrash } from "./crash.types";

const crashSchema = new Schema<ICrash>(
  {
    crashPoint: {
      type: Number,
      required: true,
      min: 1.0,
    },
    serverSeed: {
      type: String,
      required: true,
      maxlength: 64,
    },
    serverSeedHash: {
      type: String,
      required: true,
      maxlength: 64,
    },
    clientSeed: {
      type: String,
      required: true,
      maxlength: 64,
    },
    nonce: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["waiting", "running", "crashed"],
      required: true,
      default: "waiting",
    },
    startedAt: {
      type: Date,
    },
    crashedAt: {
      type: Date,
    },
  },
  {
    versionKey: false,
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

crashSchema.index({ status: 1, createdAt: -1 });
crashSchema.index({ createdAt: -1 });

export const Crash = model<ICrash>("Crash", crashSchema);
