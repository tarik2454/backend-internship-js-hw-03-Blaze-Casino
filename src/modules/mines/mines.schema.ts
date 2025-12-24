import { z } from "zod";
import { isValidObjectId } from "mongoose";

const objectIdSchema = z.string().refine((val) => isValidObjectId(val), {
  message: "Invalid ObjectId format",
});

export const startMineSchema = z.object({
  amount: z
    .number()
    .min(0.1, "Minimum bet is 0.10")
    .max(10000, "Maximum bet is 10000"),
  minesCount: z
    .number()
    .int()
    .min(1, "Minimum 1 mine")
    .max(24, "Maximum 24 mines"),
  clientSeed: z.string().optional(),
});

export const revealMineSchema = z.object({
  gameId: objectIdSchema,
  position: z
    .number()
    .int()
    .min(0, "Position must be between 0 and 24")
    .max(24, "Position must be between 0 and 24"),
});

export const cashoutMineSchema = z.object({
  gameId: objectIdSchema,
});

export const getHistorySchema = z.object({
  limit: z.preprocess((a) => {
    if (a === undefined || a === null || a === "") return undefined;
    const parsed = parseInt(String(a), 10);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().int().min(1).max(10).optional().default(10)),
  offset: z.preprocess((a) => {
    if (a === undefined || a === null || a === "") return undefined;
    const parsed = parseInt(String(a), 10);
    return isNaN(parsed) ? undefined : parsed;
  }, z.number().int().min(0).optional().default(0)),
});

export type StartMineDTO = z.infer<typeof startMineSchema>;
export type RevealMineDTO = z.infer<typeof revealMineSchema>;
export type CashoutMineDTO = z.infer<typeof cashoutMineSchema>;
export type GetHistoryDTO = z.infer<typeof getHistorySchema>;
