import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { HttpError } from "../helpers/index";

export const validateBody = (schema: z.ZodTypeAny) => {
  const func = (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error = result.error as ZodError;

      const errorMessage = error.issues
        .map((issue) => issue.message)
        .join(", ");
      return next(HttpError(400, errorMessage));
    }
    next();
  };
  return func;
};
