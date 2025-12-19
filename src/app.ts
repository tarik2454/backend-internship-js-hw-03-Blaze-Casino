import express, { Request, Response, NextFunction } from "express";
import logger from "morgan";
import cors from "cors";
import { authRouter } from "./routes/api/auth-router";
import { userRouter } from "./routes/api/user-router";
import { ExpressError } from "./types";

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
app.use(express.static("public"));

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

app.use(
  (err: ExpressError, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  }
);

export default app;
