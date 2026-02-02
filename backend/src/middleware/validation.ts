import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { createError } from './errorHandler';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(
          `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
          400
        );
      }
      throw error;
    }
  };
}
