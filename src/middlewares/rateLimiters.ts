import rateLimit from "express-rate-limit";
import { Request } from "express";

const getUserKey = (
  req: Request & { user?: { _id?: { toString(): string } } }
): string => {
  // Try to get user ID first (for authenticated requests)
  if (req.user?._id) {
    return req.user._id.toString();
  }
  // Fallback to IP address
  const ip =
    (req as any).ip ||
    req.socket?.remoteAddress ||
    req.headers["x-forwarded-for"] ||
    "unknown";
  return typeof ip === "string" ? ip.split(",")[0].trim() : String(ip);
};

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many registration attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

export const betsLimiter = rateLimit({
  windowMs: 1000,
  max: 10,
  keyGenerator: getUserKey,
  message: "Too many bet requests, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
});

export const caseOpeningLimiter = rateLimit({
  windowMs: 1000,
  max: 5,
  keyGenerator: getUserKey,
  message: "Too many case opening requests, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
});

export const minesRevealLimiter = rateLimit({
  windowMs: 1000,
  max: 20,
  keyGenerator: getUserKey,
  message: "Too many reveal requests, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 1000,
  max: 100,
  keyGenerator: getUserKey,
  message: "Too many requests, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
});
