import { Socket, Server } from 'socket.io';

export function handleConversationEvents(socket: Socket, io: Server): void {
  socket.on('conversation:join', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('conversation:leave', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on('message:typing', (data: { conversationId: string; isTyping: boolean }) => {
    socket.to(`conversation:${data.conversationId}`).emit('message:typing', {
      userId: socket.data.user?.id,
      isTyping: data.isTyping,
    });
  });
}
