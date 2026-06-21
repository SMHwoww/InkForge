/**
 * Wraps async Express route handlers to forward errors to next().
 * Required for Express 4.x which doesn't catch Promise rejections.
 */

import type { Request, Response, NextFunction } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}