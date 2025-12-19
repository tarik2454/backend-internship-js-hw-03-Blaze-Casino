import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { User } from "../models/User";
import { HttpError } from "../helpers/index";
import { ctrlWrapper } from "../decorators/index";
import { RequestWithUser } from "../types";
import { createUser } from "./user-controller";

const { JWT_SECRET } = process.env;

const signup = async (req: Request, res: Response): Promise<void> => {
  const { email, password, username } = req.body;

  const newUser = await createUser({
    email,
    password,
    username,
  });

  res.status(201).json({
    username: newUser.username,
    email: newUser.email,
  });
};

const signin = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(401, "Email is invalid");
  }

  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpError(401, "Password is invalid");
  }
  const payload = {
    id: user._id,
  };
  const token = jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: "23h",
  });

  await User.findByIdAndUpdate(user._id, { token });
  res.json({
    token,
  });
};

const signout = async (req: RequestWithUser, res: Response): Promise<void> => {
  const { _id } = req.user!;
  await User.findByIdAndUpdate(_id, { token: "" });
  res.json({ message: "Logout success" });
};

export default {
  signup: ctrlWrapper(signup),
  signin: ctrlWrapper(signin),
  signout: ctrlWrapper(signout),
};
