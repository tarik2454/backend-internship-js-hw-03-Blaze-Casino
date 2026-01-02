import { z } from "zod";

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, { message: "Refresh token is required" }),
});

export type RefreshTokenSchema = z.infer<typeof refreshTokenSchema>;

