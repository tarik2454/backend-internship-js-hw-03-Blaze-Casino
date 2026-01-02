import { Request, Response } from "express";
import { Types } from "mongoose";
import { ctrlWrapper } from "../../decorators/index";
import { AuthBodyRequest, AuthenticatedRequest } from "../../types";
import { UserSignupDTO, UserSigninDTO } from "../users/users.schema";
import authService from "./auth.service";
import auditService from "../audit/audit.service";

const signup = async (
  req: Request<Record<string, never>, Record<string, never>, UserSignupDTO>,
  res: Response
): Promise<void> => {
  const { email, password, username } = req.body;

  const newUser = await authService.signup({
    email,
    password,
    username,
  });

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    req.ip ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  auditService
    .log({
      userId: newUser._id,
      action: "REGISTER",
      entityType: "User",
      entityId: newUser._id,
      newValue: {
        username: newUser.username,
        email: newUser.email,
      },
      ipAddress: ip,
      userAgent,
    })
    .catch((err) => {
      console.error("Audit log failed:", err);
    });

  res.status(201).json({
    username: newUser.username,
    email: newUser.email,
  });
};

const signin = async (
  req: Request<Record<string, never>, Record<string, never>, UserSigninDTO>,
  res: Response
): Promise<void> => {
  const { email, password } = req.body;

  const { accessToken, refreshToken, userId, userName } =
    await authService.signin({
      email,
      password,
    });

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    req.ip ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  auditService
    .log({
      userId: new Types.ObjectId(userId),
      action: "LOGIN",
      entityType: "User",
      entityId: new Types.ObjectId(userId),
      newValue: {
        lastLoginAt: new Date(),
      },
      ipAddress: ip,
      userAgent,
    })
    .catch((err) => {
      console.error("Audit log failed:", err);
    });

  res.json({
    accessToken,
    refreshToken,
    userId,
    userName,
  });
};

const refresh = async (
  req: AuthBodyRequest<{ refreshToken: string }>,
  res: Response
): Promise<void> => {
  const { refreshToken: oldRefreshToken } = req.body;

  const { accessToken, refreshToken, userId } = await authService.refresh(
    oldRefreshToken
  );

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    req.ip ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  auditService
    .log({
      userId: new Types.ObjectId(userId),
      action: "REFRESH_TOKEN",
      entityType: "User",
      entityId: new Types.ObjectId(userId),
      newValue: {
        tokenRefreshedAt: new Date(),
      },
      ipAddress: ip,
      userAgent,
    })
    .catch((err) => {
      console.error("Audit log failed:", err);
    });

  res.json({ accessToken, refreshToken, userId });
};

const signout = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { _id } = req.user;
  await authService.signout(_id.toString());

  auditService
    .log({
      userId: _id,
      action: "LOGOUT",
      entityType: "User",
      entityId: _id,
      ipAddress: req.ip,
      userAgent: req.userAgent,
    })
    .catch((err) => {
      console.error("Audit log failed:", err);
    });

  res.json({ message: "Logout success" });
};

export default {
  signup: ctrlWrapper(signup),
  signin: ctrlWrapper(signin),
  refresh: ctrlWrapper(refresh),
  signout: ctrlWrapper(signout),
};
