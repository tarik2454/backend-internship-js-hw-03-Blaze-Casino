import { Request, Response, NextFunction } from 'express';

type ControllerFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export const ctrlWrapper = (ctrl: ControllerFunction) => {
  const func = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ctrl(req, res, next);
    } catch (err) {
      next(err);
    }
  };

  return func;
};

