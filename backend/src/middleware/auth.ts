import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    accountId: string;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw createError('Authentication token required', 401);
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw createError('JWT secret not configured', 500);
    }

    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      accountId: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError('Invalid or expired token', 401);
    }
    throw error;
  }
}
