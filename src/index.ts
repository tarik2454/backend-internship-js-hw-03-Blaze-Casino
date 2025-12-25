import "dotenv/config";
import mongoose from "mongoose";
import app from "./app";
import { validateEnv } from "./config/env";

validateEnv();

mongoose
  .connect(process.env.DB_HOST as string, {
    writeConcern: { w: "majority" },
  })
  .then(() => {
    console.log("Database connection successful");
  })
  .catch((error: Error) => {
    console.warn("Database connection error:", error.message);
  });

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
  });
}

export default app;
