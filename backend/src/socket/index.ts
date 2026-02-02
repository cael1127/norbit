import { Server } from 'socket.io';
import { authenticateSocket } from './auth';
import { handleConversationEvents } from './conversation.handlers';
import { setSocketInstance } from './manager';

export function initializeSocket(io: Server): void {
  setSocketInstance(io);
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join user's room for personalized updates
    if (socket.data.user) {
      socket.join(`user:${socket.data.user.id}`);
      socket.join(`account:${socket.data.user.accountId}`);
    }

    // Handle conversation events
    handleConversationEvents(socket, io);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
