import { z } from "zod";

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
  gameId: z.string().nonempty("Game ID is required"),
  position: z
    .number()
    .int()
    .min(0, "Position must be between 0 and 24")
    .max(24, "Position must be between 0 and 24"),
});

export const cashoutMineSchema = z.object({
  gameId: z.string().nonempty("Game ID is required"),
});

export type StartMineDTO = z.infer<typeof startMineSchema>;
export type RevealMineDTO = z.infer<typeof revealMineSchema>;
export type CashoutMineDTO = z.infer<typeof cashoutMineSchema>;
