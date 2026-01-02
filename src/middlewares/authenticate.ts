import { Response, NextFunction } from "express";
import { User } from "../modules/users/models/users.model";
import { HttpError } from "../helpers/index";
import { RequestWithUser } from "../types";
import { tokenManager } from "../modules/auth/tokens";

export const authenticate = async (
  req: RequestWithUser,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const { authorization = "" } = req.headers;
  const [bearer, token] = authorization.split(" ");
  if (bearer !== "Bearer") {
    next(HttpError(401));
    return;
  }
  try {
    const payload = tokenManager.verifyAccessToken(token);
    const user = await User.findById(payload.userId);
    if (!user) {
      next(HttpError(401));
      return;
    }
    req.user = user;
    next();
  } catch {
    next(HttpError(401));
  }
};
