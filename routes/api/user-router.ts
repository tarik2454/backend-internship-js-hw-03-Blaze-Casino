import express from "express";
import userController from "../../controllers/user-controller";
import { validateBody } from "../../decorators/index";
import { userUpdateSchema } from "../../schemas/user-schemas";
import { authenticate } from "../../middlewares/index";

const userRouter = express.Router();

userRouter.get("/current", authenticate, userController.getCurrent);

userRouter.get("/users", authenticate, userController.getAllUsers);

userRouter.patch(
  "/update",
  authenticate,
  validateBody(userUpdateSchema),
  userController.updateUser
);

export { userRouter };

