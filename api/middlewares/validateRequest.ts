/**
 * Zod validation middleware factory.
 * Creates Express middleware that validates request body/params/query against Zod schemas.
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../common/errors.js';

interface ValidationConfig {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validateRequest(config: ValidationConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (config.params) {
        const result = config.params.safeParse(req.params);
        if (!result.success) {
          throw new ValidationError('路径参数无效', result.error.flatten());
        }
        req.params = result.data;
      }

      if (config.query) {
        const result = config.query.safeParse(req.query);
        if (!result.success) {
          throw new ValidationError('查询参数无效', result.error.flatten());
        }
        req.query = result.data;
      }

      if (config.body) {
        const result = config.body.safeParse(req.body);
        if (!result.success) {
          throw new ValidationError('请求体参数无效', result.error.flatten());
        }
        req.body = result.data;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}