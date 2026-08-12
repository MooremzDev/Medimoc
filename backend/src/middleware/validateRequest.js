import { AppError } from './errorHandler.js';

export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    next(
      new AppError(
        'Pedido inválido.',
        400,
        'VALIDATION_ERROR',
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      )
    );
    return;
  }

  req.validatedBody = result.data;
  next();
};

export const validateQuery = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.query);

  if (!result.success) {
    next(
      new AppError(
        'Parâmetros de consulta inválidos.',
        400,
        'VALIDATION_ERROR',
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      )
    );
    return;
  }

  req.validatedQuery = result.data;
  next();
};
