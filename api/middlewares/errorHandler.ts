/**
 * Global error handling middleware.
 * Catches all errors thrown from route handlers and returns structured JSON responses.
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors.js';
import { logError } from '../services/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log the full error with context
  logError('ErrorHandler', 'Unhandled request error', {
    err: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  // Unknown errors
  res.status(500).json({
    code: 500,
    message: process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message || '服务器内部错误',
  });
}