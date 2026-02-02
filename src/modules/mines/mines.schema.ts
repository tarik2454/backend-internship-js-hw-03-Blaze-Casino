import { z } from "zod";
import { isValidObjectId } from "mongoose";

const objectIdSchema = z.string().refine((val) => isValidObjectId(val), {
  message: "Invalid ObjectId format",
});

export const startMineSchema = z
  .object({
    amount: z
      .number()
      .min(0.1, "Minimum bet is 0.10")
      .max(10000, "Maximum bet is 10000"),
    gridSize: z
      .number()
      .int()
      .min(5, "Grid size must be 5, 6, 7, or 8")
      .max(8, "Grid size must be 5, 6, 7, or 8")
      .optional()
      .default(5),
    minesCount: z
      .number()
      .int()
      .min(1, "Minimum 1 mine")
      .max(63, "Maximum 63 mines"),
    clientSeed: z.string().optional(),
  })
  .refine(
    (data) => data.minesCount < data.gridSize * data.gridSize,
    { message: "minesCount must be less than gridSize²", path: ["minesCount"] }
  );

export const revealMineSchema = z.object({
  gameId: objectIdSchema,
  position: z
    .number()
    .int()
    .min(0, "Position must be between 0 and gridSize² - 1")
    .max(63, "Position must be between 0 and gridSize² - 1"),
});

export const cashoutMineSchema = z.object({
  gameId: objectIdSchema,
});

export const getHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).optional().default(10),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type StartMineDTO = z.infer<typeof startMineSchema>;
export type RevealMineDTO = z.infer<typeof revealMineSchema>;
export type CashoutMineDTO = z.infer<typeof cashoutMineSchema>;
export type GetHistoryDTO = z.infer<typeof getHistorySchema>;
