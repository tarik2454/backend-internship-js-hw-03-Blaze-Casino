import express from "express";
import { authenticate, betsLimiter, generalLimiter } from "../../middlewares";
import { validateBody, validateQuery } from "../../decorators";
import plinkoController from "./plinko.controller";
import {
  dropPlinkoSchema,
  getMultipliersSchema,
  getHistorySchema,
} from "./plinko.schema";

const plinkoRouter = express.Router();

plinkoRouter.post(
  "/drop",
  authenticate,
  betsLimiter,
  validateBody(dropPlinkoSchema),
  plinkoController.dropPlinko
);

plinkoRouter.get(
  "/multipliers",
  authenticate,
  generalLimiter,
  validateQuery(getMultipliersSchema),
  plinkoController.getMultipliers
);

plinkoRouter.get(
  "/history",
  authenticate,
  generalLimiter,
  validateQuery(getHistorySchema),
  plinkoController.getHistory
);

plinkoRouter.get(
  "/recent",
  authenticate,
  generalLimiter,
  plinkoController.getRecent
);

export { plinkoRouter };
