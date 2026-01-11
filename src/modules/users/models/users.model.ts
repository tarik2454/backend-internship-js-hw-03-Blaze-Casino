import mongoose, { Schema, Model } from "mongoose";
import {
  handleSaveError,
  preUpdate,
  handleFindOneAndUpdateError,
} from "../../../helpers/index";
import { IUser } from "./users.types";

const emailRegexp = /^\w+([\\.-]?\w+)*@\w+([\\.-]?\w+)*(\.\w{2,3})+$/;

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
    },
    email: {
      type: String,
      match: emailRegexp,
      required: [true, "Email is required"],
      unique: true,
    },
    password: {
      type: String,
      minlength: 6,
      required: [true, "Set password for user"],
    },
    avatarURL: { type: String, default: null },
    token: { type: String },
    balance: {
      type: Number,
      default: 0,
    },
    totalWagered: {
      type: Number,
      default: 0,
    },
    gamesPlayed: {
      type: Number,
      default: 0,
    },
    totalWon: {
      type: Number,
      default: 0,
    },
    lastBonusClaimAt: { type: Date },
    nonce: { type: Number, default: 0 },
    serverSeed: { type: String },
    clientSeed: { type: String },
  },
  { versionKey: false, timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

userSchema.post("save", handleSaveError);
userSchema.pre("findOneAndUpdate", preUpdate);
userSchema.post("findOneAndUpdate", handleFindOneAndUpdateError);

const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);

export { User };
