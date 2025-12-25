import { z } from "zod";
import { isValidObjectId } from "mongoose";

const objectIdSchema = z.string().refine((val) => isValidObjectId(val), {
  message: "Invalid ObjectId format",
});

export const betCrashSchema = z.object({
  amount: z
    .number()
    .min(0.1, "Minimum bet is 0.10")
    .max(10000, "Maximum bet is 10000"),
  autoCashout: z
    .number()
    .min(1.0, "Auto cashout multiplier must be at least 1.00")
    .optional(),
});

export const cashoutCrashSchema = z.object({
  betId: objectIdSchema,
});

export const getCrashHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type BetCrashDTO = z.infer<typeof betCrashSchema>;
export type CashoutCrashDTO = z.infer<typeof cashoutCrashSchema>;
export type GetCrashHistoryDTO = z.infer<typeof getCrashHistorySchema>;

