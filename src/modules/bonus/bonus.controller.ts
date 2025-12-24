import { Response } from "express";
import { AuthenticatedRequest } from "../../types";
import { ctrlWrapper } from "../../decorators/index";
import bonusService from "./bonus.service";

const getStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const status = await bonusService.getStatus(req.user);
  res.json(status);
};

const claimBonus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const result = await bonusService.claimBonus(req.user);
  res.json(result);
};

export default {
  getStatus: ctrlWrapper(getStatus),
  claimBonus: ctrlWrapper(claimBonus),
};
