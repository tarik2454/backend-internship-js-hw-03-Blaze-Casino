import express from "express";
import { authenticate } from "../../middlewares";
import { validateBody, validateQuery } from "../../decorators";
import plinkoController from "./plinko.controller";
import { dropPlinkoSchema, getMultipliersSchema } from "./plinko.schema";

const plinkoRouter = express.Router();

plinkoRouter.post(
  "/drop",
  authenticate,
  validateBody(dropPlinkoSchema),
  plinkoController.dropPlinko
);

plinkoRouter.get(
  "/multipliers",
  authenticate,
  validateQuery(getMultipliersSchema),
  plinkoController.getMultipliers
);

plinkoRouter.get("/history", authenticate, plinkoController.getHistory);

plinkoRouter.get("/recent", authenticate, plinkoController.getRecent);

export { plinkoRouter };
