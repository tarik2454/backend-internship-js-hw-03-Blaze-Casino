import express, { NextFunction, Request, Response } from "express";
import path from "path";
import logger from "morgan";
import cors from "cors";
import { authRouter } from "./modules/auth/auth.router";
import { userRouter } from "./modules/users/users.router";
import { caseRouter } from "./modules/cases/cases.router";
import { ExpressError } from "./types";
import { minesRouter } from "./modules/mines/mines.router";
import { plinkoRouter } from "./modules/plinko/plinko.router";
import { loginLimiter, registerLimiter } from "./middlewares";
import { claimBonusRouter } from "./modules/bonus/bonus.router";
import { leaderboardRouter } from "./modules/leaderboard/leaderboard.router";
import { chatRouter } from "./modules/chat/chat.router";
import { auditRouter } from "./modules/audit/audit.router";
import { crashRouter } from "./modules/crash/crash.router";

const app = express();

app.set("trust proxy", true);

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

app.use(logger(formatsLogger));
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/cases", caseRouter);
app.use("/api/mines", minesRouter);
app.use("/api/plinko", plinkoRouter);
app.use("/api/bonus", claimBonusRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/crash", crashRouter);
app.use("/api/chat", chatRouter);
app.use("/api/audit", auditRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

app.use(
  (err: ExpressError, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Error:", {
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      status: err.status || err.statusCode,
    });

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  }
);

export default app;
