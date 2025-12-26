import express from "express";
import casesController from "./cases.controller";
import {
  authenticate,
  collectRequestInfo,
  isValidId,
  caseOpeningLimiter,
  generalLimiter,
} from "../../middlewares/index";
import { validateBody, validateQuery } from "../../decorators/index";
import { openCaseSchema, getHistorySchema } from "./cases.schema";

const caseRouter = express.Router();

caseRouter.get("/", authenticate, generalLimiter, casesController.getAllCases);

caseRouter.get(
  "/:id",
  authenticate,
  generalLimiter,
  isValidId,
  casesController.getCaseById
);

caseRouter.post(
  "/:id/open",
  authenticate,
  collectRequestInfo,
  isValidId,
  caseOpeningLimiter,
  validateBody(openCaseSchema),
  casesController.openCase
);

caseRouter.get(
  "/history",
  authenticate,
  generalLimiter,
  validateQuery(getHistorySchema),
  casesController.getHistory
);

export { caseRouter };
