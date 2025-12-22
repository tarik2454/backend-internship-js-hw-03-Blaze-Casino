import express from "express";
import minesController from "./mines.controller";
import { authenticate } from "../../middlewares";
import { validateBody } from "../../decorators";
import {
  startMineSchema,
  revealMineSchema,
  cashoutMineSchema,
} from "./mines.schema";

const minesRouter = express.Router();

minesRouter.post(
  "/start",
  authenticate,
  validateBody(startMineSchema),
  minesController.startMine
);

minesRouter.post(
  "/reveal",
  authenticate,
  validateBody(revealMineSchema),
  minesController.revealMine
);

minesRouter.post(
  "/cashout",
  authenticate,
  validateBody(cashoutMineSchema),
  minesController.cashoutMine
);

minesRouter.get("/active", authenticate, minesController.activateMine);

minesRouter.get("/history", authenticate, minesController.historyMine);

export { minesRouter };
