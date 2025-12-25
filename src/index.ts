import "dotenv/config";
import mongoose from "mongoose";
import { validateEnv } from "./config/env";
import app from "./app";

validateEnv();

mongoose
  .connect(process.env.DB_HOST as string, {
    writeConcern: { w: "majority" },
  })
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log("Database connection successful");
      console.log(`Server running on port: ${process.env.PORT}`);
    });
  })
  .catch((error: Error) => {
    console.warn(error.message);
    process.exit(1);
  });
