import express from "express";
import { authenticate, generalLimiter } from "../../middlewares/index";
import claimBonusController from "./bonus.controller";

const claimBonusRouter = express.Router();

claimBonusRouter.get(
  "/status",
  authenticate,
  generalLimiter,
  claimBonusController.getStatus
);

claimBonusRouter.post(
  "/claim",
  authenticate,
  generalLimiter,
  claimBonusController.claimBonus
);

export { claimBonusRouter };
