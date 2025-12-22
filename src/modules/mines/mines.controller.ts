import { Response } from "express";
import { ctrlWrapper } from "../../decorators";
import minesService from "./mines.service";
import { AuthenticatedRequest } from "../../types";
import { StartMineDTO, RevealMineDTO, CashoutMineDTO } from "./mines.schema";
import { HydratedDocument } from "mongoose";
import { IUser } from "../users/users.types";

const startMine = async (
  req: AuthenticatedRequest<
    Record<string, never>,
    Record<string, never>,
    StartMineDTO
  >,
  res: Response
) => {
  const { amount, minesCount, clientSeed } = req.body;
  const user = req.user as HydratedDocument<IUser>;
  const result = await minesService.startMine(
    user,
    amount,
    minesCount,
    clientSeed
  );
  res.status(201).json(result);
};

const revealMine = async (
  req: AuthenticatedRequest<
    Record<string, never>,
    Record<string, never>,
    RevealMineDTO
  >,
  res: Response
) => {
  const { gameId, position } = req.body;
  const user = req.user as HydratedDocument<IUser>;
  const result = await minesService.revealMine(user, gameId, position);
  res.json(result);
};

const cashoutMine = async (
  req: AuthenticatedRequest<
    Record<string, never>,
    Record<string, never>,
    CashoutMineDTO
  >,
  res: Response
) => {
  const { gameId } = req.body;
  const user = req.user as HydratedDocument<IUser>;
  const result = await minesService.cashoutMine(user, gameId);
  res.json(result);
};

const activateMine = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user as HydratedDocument<IUser>;
  const result = await minesService.getActiveGame(user);
  res.json(result);
};

const historyMine = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user as HydratedDocument<IUser>;
  const { limit = 10, offset = 0 } = req.query;
  const result = await minesService.getHistory(
    user,
    Number(limit),
    Number(offset)
  );
  res.json(result);
};

export default {
  startMine: ctrlWrapper(startMine),
  revealMine: ctrlWrapper(revealMine),
  cashoutMine: ctrlWrapper(cashoutMine),
  activateMine: ctrlWrapper(activateMine),
  historyMine: ctrlWrapper(historyMine),
};
