import { z } from "zod";

export const openCaseSchema = z.object({
  clientSeed: z.string().optional(),
});

export const getHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).optional().default(10),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type OpenCaseDTO = z.infer<typeof openCaseSchema>;
export type GetHistoryDTO = z.infer<typeof getHistorySchema>;
