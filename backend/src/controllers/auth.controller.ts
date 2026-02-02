import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  accountName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const data = registerSchema.parse(req.body);
      const { email, password, firstName, lastName, accountName } = data;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw createError('User with this email already exists', 409);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create account and user
      const account = await prisma.account.create({
        data: {
          name: accountName || `${firstName || 'User'}'s Account`,
        },
      });

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          accountId: account.id,
        },
      });

      // Generate tokens
      const token = this.generateToken(user.id, user.email, account.id);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            accountId: user.accountId,
          },
          token,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`, 400);
      }
      throw error;
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const data = loginSchema.parse(req.body);
      const { email, password } = data;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        include: { account: true },
      });

      if (!user) {
        throw createError('Invalid email or password', 401);
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw createError('Invalid email or password', 401);
      }

      // Generate token
      const token = this.generateToken(user.id, user.email, user.accountId);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            accountId: user.accountId,
          },
          token,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`, 400);
      }
      throw error;
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    // TODO: Implement refresh token logic
    throw createError('Not implemented', 501);
  }

  async logout(req: Request, res: Response): Promise<void> {
    // TODO: Implement token blacklisting
    res.json({ success: true, message: 'Logged out successfully' });
  }

  private generateToken(userId: string, email: string, accountId: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw createError('JWT secret not configured', 500);
    }

    return jwt.sign(
      { id: userId, email, accountId },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }
}
