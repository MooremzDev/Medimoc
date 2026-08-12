import { isDevelopment } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export const errorHandler = (error, req, res, _next) => {
  const statusCode = error.statusCode ?? 500;
  const code = error.code ?? 'INTERNAL_ERROR';
  const isInternalError = statusCode >= 500;

  logger.error('Request failed', {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    message: error.message,
    stack: isDevelopment ? error.stack : undefined
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: isInternalError && !isDevelopment ? 'Erro interno do servidor.' : error.message,
      details: error.details
    }
  });
};
