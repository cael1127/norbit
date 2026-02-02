import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';
import { getSocketInstance } from '../socket/manager';
import { AgentService } from '../services/agent.service';

const prisma = new PrismaClient();
const agentService = new AgentService();

const createConversationSchema = z.object({
  leadId: z.string().uuid().optional(),
  title: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']).default('user'),
});

export class ConversationController {
  async getConversations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountId = req.user!.accountId;
      const { page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where: { accountId },
          skip,
          take: limitNum,
          orderBy: { updatedAt: 'desc' },
          include: {
            lead: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                company: true,
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        }),
        prisma.conversation.count({ where: { accountId } }),
      ]);

      res.json({
        success: true,
        data: {
          conversations,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async getConversationById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const accountId = req.user!.accountId;

      const conversation = await prisma.conversation.findFirst({
        where: { id, accountId },
        include: {
          lead: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conversation) {
        throw createError('Conversation not found', 404);
      }

      res.json({ success: true, data: { conversation } });
    } catch (error) {
      throw error;
    }
  }

  async createConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = createConversationSchema.parse(req.body);
      const accountId = req.user!.accountId;

      const conversation = await prisma.conversation.create({
        data: {
          accountId,
          leadId: data.leadId,
          title: data.title,
        },
      });

      res.status(201).json({ success: true, data: { conversation } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`, 400);
      }
      throw error;
    }
  }

  async sendMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = sendMessageSchema.parse(req.body);
      const accountId = req.user!.accountId;

      const conversation = await prisma.conversation.findFirst({
        where: { id, accountId },
      });

      if (!conversation) {
        throw createError('Conversation not found', 404);
      }

      // Create user message
      const message = await prisma.message.create({
        data: {
          conversationId: id,
          role: data.role,
          content: data.content,
        },
      });

      // Emit to socket room
      const io = getSocketInstance();
      io.to(`conversation:${id}`).emit('message:new', message);

      // Update conversation
      await prisma.conversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      // If user message, process with AI agent
      if (data.role === 'user') {
        // Process message asynchronously and stream response
        this.processAgentResponse(id, data.content, accountId);
      }

      res.status(201).json({ success: true, data: { message } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`, 400);
      }
      throw error;
    }
  }

  private async processAgentResponse(
    conversationId: string,
    message: string,
    accountId: string
  ): Promise<void> {
    try {
      const io = getSocketInstance();
      const stream = agentService.processMessage(conversationId, message, accountId);
      let fullResponse = '';

      for await (const chunk of stream) {
        fullResponse += chunk;
        io.to(`conversation:${conversationId}`).emit('message:stream', {
          conversationId,
          chunk,
          fullResponse,
        });
      }
    } catch (error: any) {
      const io = getSocketInstance();
      io.to(`conversation:${conversationId}`).emit('message:error', {
        conversationId,
        error: error.message,
      });
    }
  }

  async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { page = '1', limit = '50' } = req.query;
      const accountId = req.user!.accountId;

      const conversation = await prisma.conversation.findFirst({
        where: { id, accountId },
      });

      if (!conversation) {
        throw createError('Conversation not found', 404);
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where: { conversationId: id },
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.message.count({ where: { conversationId: id } }),
      ]);

      res.json({
        success: true,
        data: {
          messages: messages.reverse(), // Return in chronological order
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }
}
