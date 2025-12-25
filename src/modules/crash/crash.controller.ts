import { Response } from "express";
import { ctrlWrapper } from "../../decorators";
import { AuthBodyRequest, AuthenticatedRequest } from "../../types";
import {
  BetCrashDTO,
  CashoutCrashDTO,
  GetCrashHistoryDTO,
  GetBetHistoryDTO,
} from "./crash.schema";
import crashService from "./crash.service";

const betCrash = async (req: AuthBodyRequest<BetCrashDTO>, res: Response) => {
  const { amount, autoCashout } = req.body;
  const user = req.user;

  const result = await crashService.betCrash(
    user,
    amount,
    autoCashout,
    req.ip,
    req.userAgent
  );
  res.status(201).json(result);
};

const cashoutCrash = async (
  req: AuthBodyRequest<CashoutCrashDTO>,
  res: Response
) => {
  const { betId } = req.body;
  const user = req.user;

  const result = await crashService.cashoutCrash(
    user,
    betId,
    req.ip,
    req.userAgent
  );
  res.json(result);
};

const getCrashHistory = async (req: AuthenticatedRequest, res: Response) => {
  let { limit = 10, offset = 0 } = req.query as unknown as GetCrashHistoryDTO;

  limit = Math.min(Number(limit), 10);
  offset = Math.max(Number(offset), 0);

  const result = await crashService.getCrashHistory(limit, offset);
  res.json(result);
};

const getCurrentCrash = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const result = await crashService.getCurrentCrash(user);
  res.json(result);
};

const getUserBetHistory = async (req: AuthenticatedRequest, res: Response) => {
  let { limit = 10, offset = 0 } = req.query as unknown as GetBetHistoryDTO;

  limit = Math.min(Number(limit), 10);
  offset = Math.max(Number(offset), 0);

  const user = req.user;
  const result = await crashService.getUserBetHistory(user, limit, offset);
  res.json(result);
};

export default {
  betCrash: ctrlWrapper(betCrash),
  cashoutCrash: ctrlWrapper(cashoutCrash),
  getCrashHistory: ctrlWrapper(getCrashHistory),
  getCurrentCrash: ctrlWrapper(getCurrentCrash),
  getUserBetHistory: ctrlWrapper(getUserBetHistory),
};
