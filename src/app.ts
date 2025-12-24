import express, { Request, Response, NextFunction } from "express";
import path from "path";
import logger from "morgan";
import cors from "cors";
import { swaggerSpec } from "./config/swagger";
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

app.use((req: Request, res: Response, next: NextFunction) => {
  if (
    req.path.includes("swagger-ui-init.js") ||
    req.path.includes("swagger-ui.css") ||
    req.path.includes("swagger-ui-bundle.js") ||
    req.path.includes("swagger-ui-standalone-preset.js")
  ) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  next();
});

app.use(express.static(path.join(__dirname, "../public")));

app.get("/api-docs/swagger.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.get("/api-docs", (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SkyRush API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    .swagger-ui .topbar { display: none }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "/api-docs/swagger.json",
        dom_id: "#swagger-ui",
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true
      });
    };
  </script>
</body>
</html>`;
  res.send(html);
});

app.get("/api-docs/", (_req: Request, res: Response) => {
  res.redirect("/api-docs");
});

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
