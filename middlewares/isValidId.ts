import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { HttpError } from '../helpers/index';

const isValidId = (req: Request, res: Response, next: NextFunction): void => {
  const { contactId } = req.params;
  if (!isValidObjectId(contactId)) {
    return next(HttpError(404, `${contactId} is not a valid id`));
  }
  next();
};

export default isValidId;

