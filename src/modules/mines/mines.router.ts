import express from "express";
import minesController from "./mines.controller";
import {
  authenticate,
  betsLimiter,
  minesRevealLimiter,
  generalLimiter,
} from "../../middlewares";
import { validateBody, validateQuery } from "../../decorators";
import {
  startMineSchema,
  revealMineSchema,
  cashoutMineSchema,
  getHistorySchema,
} from "./mines.schema";

const minesRouter = express.Router();

minesRouter.post(
  "/start",
  authenticate,
  betsLimiter,
  validateBody(startMineSchema),
  minesController.startMine
);

minesRouter.post(
  "/reveal",
  authenticate,
  minesRevealLimiter,
  validateBody(revealMineSchema),
  minesController.revealMine
);

minesRouter.post(
  "/cashout",
  authenticate,
  generalLimiter,
  validateBody(cashoutMineSchema),
  minesController.cashoutMine
);

minesRouter.get(
  "/active",
  authenticate,
  generalLimiter,
  minesController.activateMine
);

minesRouter.get(
  "/history",
  authenticate,
  generalLimiter,
  validateQuery(getHistorySchema),
  minesController.historyMine
);

export { minesRouter };
