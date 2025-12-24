import { Request, Response, NextFunction } from "express";

export const collectRequestInfo = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  let ip = "unknown";
  let userAgent = "unknown";

  try {
    const forwardedFor = req.headers["x-forwarded-for"];
    if (forwardedFor && typeof forwardedFor === "string") {
      ip = forwardedFor.split(",")[0].trim();
    } else if (
      req.headers["x-real-ip"] &&
      typeof req.headers["x-real-ip"] === "string"
    ) {
      ip = req.headers["x-real-ip"];
    } else if (req.socket?.remoteAddress) {
      ip = req.socket.remoteAddress;
    } else if (req.ip) {
      ip = req.ip;
    }

    if (
      req.headers["user-agent"] &&
      typeof req.headers["user-agent"] === "string"
    ) {
      userAgent = req.headers["user-agent"];
    }
  } catch (error) {
    console.error("Error collecting request info:", error);
  }

  try {
    Object.defineProperty(req, "ip", {
      value: ip,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    Object.defineProperty(req, "userAgent", {
      value: userAgent,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } catch (defineError) {
    (req as unknown as Record<string, unknown>).ip = ip;
    (req as unknown as Record<string, unknown>).userAgent = userAgent;
  }

  next();
};
