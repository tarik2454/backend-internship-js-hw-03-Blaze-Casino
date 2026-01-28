import { Schema, model } from "mongoose";
import { ICase } from "./cases.types";

const caseSchema = new Schema<ICase>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    description: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

caseSchema.index({ isActive: 1 });

export const Case = model<ICase>("Case", caseSchema);
