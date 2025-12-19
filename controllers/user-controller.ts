import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { User } from "../models/User";
import { HttpError } from "../helpers/index";
import { ctrlWrapper } from "../decorators/index";
import { RequestWithUser, IUser } from "../types";

export const createUser = async (userData: {
  username: string;
  email: string;
  password: string;
}): Promise<IUser> => {
  const { email, password, ...restData } = userData;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw HttpError(409, "Email already in use");
  }

  const hashPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    ...restData,
    email,
    password: hashPassword,
  });

  return newUser;
};

const getCurrent = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  const { username, email, balance, totalWagered, gamesPlayed, totalWon } =
    req.user!;

  res.json({
    username,
    email,
    balance,
    totalWagered,
    gamesPlayed,
    totalWon,
  });
};

const updateUser = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  const { username, balance, totalWagered, gamesPlayed, totalWon } = req.body;

  const updateData: Partial<
    Pick<
      IUser,
      "username" | "balance" | "totalWagered" | "gamesPlayed" | "totalWon"
    >
  > = {};
  if (username) updateData.username = username;
  if (balance !== undefined) updateData.balance = balance;
  if (totalWagered !== undefined) updateData.totalWagered = totalWagered;
  if (gamesPlayed !== undefined) updateData.gamesPlayed = gamesPlayed;
  if (totalWon !== undefined) updateData.totalWon = totalWon;

  const updated = await User.findByIdAndUpdate(req.user!._id, updateData, {
    new: true,
  }).select("username email balance totalWagered gamesPlayed totalWon");

  if (!updated) {
    throw HttpError(404, "User not found");
  }

  res.json(updated);
};

const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await User.find({}, "username gamesPlayed balance");

  res.json(users);
};

export default {
  getCurrent: ctrlWrapper(getCurrent),
  getAllUsers: ctrlWrapper(getAllUsers),
  updateUser: ctrlWrapper(updateUser),
};

