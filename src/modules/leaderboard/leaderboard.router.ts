import express from "express";
import { authenticate, generalLimiter } from "../../middlewares/index";
import leaderboardController from "./leaderboard.controller";

const leaderboardRouter = express.Router();

leaderboardRouter.get(
  "/",
  authenticate,
  generalLimiter,
  leaderboardController.getLeaderboard
);

export { leaderboardRouter };

