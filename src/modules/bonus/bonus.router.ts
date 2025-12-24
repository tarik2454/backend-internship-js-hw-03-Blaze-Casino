import express from "express";
import { authenticate } from "../../middlewares/index";
import claimBonusController from "./bonus.controller";

const claimBonusRouter = express.Router();

claimBonusRouter.get("/status", authenticate, claimBonusController.getStatus);

claimBonusRouter.post("/claim", authenticate, claimBonusController.claimBonus);

export { claimBonusRouter };
