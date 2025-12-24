import { z } from "zod";

export const dropPlinkoSchema = z.object({
  amount: z
    .number({ error: '"amount" is a required field' })
    .min(0.1, { message: "Minimum bet is 0.10" })
    .max(100, { message: "Maximum bet is 100" }),
  balls: z
    .number({ error: '"balls" is a required field' })
    .int({ message: '"balls" must be an integer' })
    .refine((val) => [1, 2, 5, 10].includes(val), {
      message: "Balls must be one of: 1, 2, 5, 10",
    }),
  risk: z.enum(["low", "medium", "high"], {
    error: '"risk" is a required field',
  }),
  lines: z
    .number({ error: '"lines" is a required field' })
    .int({ message: '"lines" must be an integer' })
    .min(8, { message: "Minimum 8 lines" })
    .max(16, { message: "Maximum 16 lines" }),
});

export const getMultipliersSchema = z.object({
  risk: z.preprocess(
    (val) => (Array.isArray(val) ? val[0] : val),
    z
      .string({ error: '"risk" is a required field' })
      .refine(
        (val) => val !== undefined && ["low", "medium", "high"].includes(val),
        { message: '"risk" must be low, medium, or high' }
      )
  ),
  lines: z.preprocess((val) => {
    const str = Array.isArray(val) ? val[0] : val;
    return str ? parseInt(String(str), 10) : undefined;
  }, z.number({ error: '"lines" is a required field' }).int().min(8).max(16)),
});

export const getHistorySchema = z.object({
  limit: z.preprocess(
    (a) => {
      if (a === undefined || a === null || a === "") return undefined;
      const parsed = parseInt(String(a), 10);
      return isNaN(parsed) ? undefined : parsed;
    },
    z.number().int().min(1).max(10).optional().default(10)
  ),
  offset: z.preprocess(
    (a) => {
      if (a === undefined || a === null || a === "") return undefined;
      const parsed = parseInt(String(a), 10);
      return isNaN(parsed) ? undefined : parsed;
    },
    z.number().int().min(0).optional().default(0)
  ),
});

export type DropPlinkoDTO = z.infer<typeof dropPlinkoSchema>;
export type GetMultipliersDTO = z.infer<typeof getMultipliersSchema>;
export type GetHistoryDTO = z.infer<typeof getHistorySchema>;
