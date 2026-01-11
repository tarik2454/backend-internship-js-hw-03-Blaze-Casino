import { Request, Response } from "express";
import { HttpError } from "../../helpers/index";
import { ctrlWrapper } from "../../decorators/index";
import { AuthenticatedRequest } from "../../types";
import { UserUpdateDTO } from "./users.schema";
import usersService from "./users.service";

const getCurrent = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const {
    _id,
    username,
    email,
    avatarURL,
    balance,
    totalWagered,
    gamesPlayed,
    totalWon,
  } = req.user;

  res.json({
    _id: _id.toString(),
    username,
    email,
    avatarURL,
    balance,
    totalWagered,
    gamesPlayed,
    totalWon,
  });
};

const updateUser = async (
  req: AuthenticatedRequest<
    Record<string, never>,
    Record<string, never>,
    UserUpdateDTO
  >,
  res: Response
): Promise<void> => {
  const { username, avatarURL, balance, totalWagered, gamesPlayed, totalWon } =
    req.body;

  const updateData: Partial<UserUpdateDTO> = {};
  if (username) updateData.username = username;
  if (avatarURL) updateData.avatarURL = avatarURL;
  if (balance !== undefined) updateData.balance = balance;
  if (totalWagered !== undefined) updateData.totalWagered = totalWagered;
  if (gamesPlayed !== undefined) updateData.gamesPlayed = gamesPlayed;
  if (totalWon !== undefined) updateData.totalWon = totalWon;

  const updated = await usersService.updateUser(
    req.user._id.toString(),
    updateData
  );

  if (!updated) {
    throw HttpError(404, "User not found");
  }

  res.json(updated);
};

const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await usersService.getAllUsers();

  res.json(users);
};

export default {
  getCurrent: ctrlWrapper(getCurrent),
  getAllUsers: ctrlWrapper(getAllUsers),
  updateUser: ctrlWrapper(updateUser),
};
