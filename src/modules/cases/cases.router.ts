import express from "express";
import casesController from "./cases.controller";
import {
  authenticate,
  isValidId,
  caseOpeningLimiter,
  generalLimiter,
} from "../../middlewares/index";
import { validateBody } from "../../decorators/index";
import { openCaseSchema } from "./cases.schema";

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
  isValidId,
  caseOpeningLimiter,
  validateBody(openCaseSchema),
  casesController.openCase
);

export { caseRouter };
