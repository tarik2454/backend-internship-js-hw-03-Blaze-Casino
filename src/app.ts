import express, { Request, Response } from "express";
import path from "path";
import logger from "morgan";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./modules/auth/auth.router";
import { userRouter } from "./modules/users/users.router";
import { caseRouter } from "./modules/cases/cases.router";
import { ExpressError } from "./types";
import { minesRouter } from "./modules/mines/mines.router";
import { plinkoRouter } from "./modules/plinko/plinko.router";
import { loginLimiter, registerLimiter } from "./middlewares";
import { claimBonusRouter } from "./modules/bonus/bonus.router";

const app = express();

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "development" ? false : undefined,
  })
);
app.use(logger(formatsLogger));
app.use(
  cors({
    origin: true,
    credentials: true,
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

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err: ExpressError, _req: Request, res: Response) => {
  console.error("Error:", {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    status: err.status || err.statusCode,
  });

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

export default app;
