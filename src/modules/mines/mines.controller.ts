import { Response } from "express";
import { ctrlWrapper } from "../../decorators";
import minesService from "./mines.service";
import { AuthBodyRequest, AuthenticatedRequest } from "../../types";
import {
  StartMineDTO,
  RevealMineDTO,
  CashoutMineDTO,
  GetHistoryDTO,
} from "./mines.schema";

const startMine = async (req: AuthBodyRequest<StartMineDTO>, res: Response) => {
  const { amount, minesCount, clientSeed, gridSize } = req.body;
  const user = req.user;

  const result = await minesService.startMine(
    user,
    amount,
    minesCount,
    clientSeed,
    gridSize,
    req.ip,
    req.userAgent
  );
  res.status(201).json(result);
};

const revealMine = async (
  req: AuthBodyRequest<RevealMineDTO>,
  res: Response
) => {
  const { gameId, position } = req.body;
  const user = req.user;

  const result = await minesService.revealMine(
    user,
    gameId,
    position,
    req.ip,
    req.userAgent
  );
  res.json(result);
};

const cashoutMine = async (
  req: AuthBodyRequest<CashoutMineDTO>,
  res: Response
) => {
  const { gameId } = req.body;
  const user = req.user;

  const result = await minesService.cashoutMine(
    user,
    gameId,
    req.ip,
    req.userAgent
  );
  res.json(result);
};

const activateMine = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const result = await minesService.getActiveGame(user);
  res.json(result);
};

const historyMine = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const user = req.user;
  let { limit = 10, offset = 0 } = req.query as unknown as GetHistoryDTO;

  limit = Math.min(Number(limit), 10);
  offset = Math.max(Number(offset), 0);

  const result = await minesService.getHistory(user, limit, offset);
  res.json(result);
};

export default {
  startMine: ctrlWrapper(startMine),
  revealMine: ctrlWrapper(revealMine),
  cashoutMine: ctrlWrapper(cashoutMine),
  activateMine: ctrlWrapper(activateMine),
  historyMine: ctrlWrapper(historyMine),
};
