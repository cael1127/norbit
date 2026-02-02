import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error('JWT secret not configured'));
    }

    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      accountId: string;
    };

    socket.data.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid or expired token'));
  }
}
