import { Error, NextFunction } from 'mongoose';

export const handleSaveError = (
  err: any,
  data: any,
  next: NextFunction
): void => {
  const { name, code } = err;
  err.status = name === 'MongoServerError' && code === 11000 ? 409 : 400;
  next();
};

export const preUpdate = function (this: any, next: NextFunction): void {
  this.options.new = true;
  this.options.runValidators = true;
  next();
};

