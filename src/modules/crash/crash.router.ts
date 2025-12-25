import express from "express";
import { validateBody, validateQuery } from "../../decorators";
import {
  authenticate,
  collectRequestInfo,
  betsLimiter,
  generalLimiter,
} from "../../middlewares";
import crashController from "./crash.controller";
import {
  betCrashSchema,
  cashoutCrashSchema,
  getCrashHistorySchema,
  getBetHistorySchema,
} from "./crash.schema";

const crashRouter = express.Router();

crashRouter.post(
  "/bet",
  authenticate,
  collectRequestInfo,
  betsLimiter,
  validateBody(betCrashSchema),
  crashController.betCrash
);

crashRouter.post(
  "/cashout",
  authenticate,
  collectRequestInfo,
  generalLimiter,
  validateBody(cashoutCrashSchema),
  crashController.cashoutCrash
);

crashRouter.get(
  "/history",
  authenticate,
  generalLimiter,
  validateQuery(getCrashHistorySchema),
  crashController.getCrashHistory
);

crashRouter.get(
  "/current",
  authenticate,
  generalLimiter,
  crashController.getCurrentCrash
);

crashRouter.get(
  "/bets/history",
  authenticate,
  generalLimiter,
  validateQuery(getBetHistorySchema),
  crashController.getUserBetHistory
);

export { crashRouter };
