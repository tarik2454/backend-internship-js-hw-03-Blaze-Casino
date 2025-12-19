import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { HttpError } from '../helpers/index';

export const validateBody = (schema: Schema) => {
  const func = (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    if (error) {
      return next(HttpError(400, error.message));
    }
    next();
  };
  return func;
};

