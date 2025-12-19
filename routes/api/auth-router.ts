import express from "express";
import authController from "../../controllers/auth-controller";
import { validateBody } from "../../decorators/index";
import {
  userSignupSchema,
  userSigninSchema,
} from "../../schemas/user-schemas";
import { authenticate } from "../../middlewares/index";

const authRouter = express.Router();

authRouter.post(
  "/register",
  validateBody(userSignupSchema),
  authController.signup
);

authRouter.post(
  "/login",
  validateBody(userSigninSchema),
  authController.signin
);

authRouter.post("/logout", authenticate, authController.signout);

export { authRouter };
