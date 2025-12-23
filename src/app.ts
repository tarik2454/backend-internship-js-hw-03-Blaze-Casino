import express, { Request, Response } from "express";
import path from "path";
import logger from "morgan";
import cors from "cors";
import { authRouter } from "./modules/auth/auth.router";
import { userRouter } from "./modules/users/users.router";
import { caseRouter } from "./modules/cases/cases.router";
import { ExpressError } from "./types";
import { minesRouter } from "./modules/mines/mines.router";
import { plinkoRouter } from "./modules/plinko/plinko.router";

const app = express();

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

app.use(logger(formatsLogger));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/cases", caseRouter);
app.use("/api/mines", minesRouter);
app.use("/api/plinko", plinkoRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err: ExpressError, _req: Request, res: Response) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

export default app;
