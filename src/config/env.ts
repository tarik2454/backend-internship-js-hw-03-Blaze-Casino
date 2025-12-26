const requiredEnvVars = ["DB_HOST", "JWT_SECRET", "PORT", "NODE_ENV"];

export function validateEnv(): void {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
