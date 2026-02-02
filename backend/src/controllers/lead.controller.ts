import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

const prisma = new PrismaClient();

const createLeadSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  website: z.string().url().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const updateLeadSchema = createLeadSchema.partial();

export class LeadController {
  async getLeads(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, search, page = '1', limit = '20' } = req.query;
      const accountId = req.user!.accountId;

      const where: any = { accountId };
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { email: { contains: search as string, mode: 'insensitive' } },
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { company: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            activities: {
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        }),
        prisma.lead.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          leads,
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

  async getLeadById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const accountId = req.user!.accountId;

      const lead = await prisma.lead.findFirst({
        where: { id, accountId },
        include: {
          activities: {
            orderBy: { createdAt: 'desc' },
          },
          conversations: {
            take: 5,
            orderBy: { updatedAt: 'desc' },
          },
          calendarEvents: {
            take: 5,
            orderBy: { startTime: 'desc' },
          },
        },
      });

      if (!lead) {
        throw createError('Lead not found', 404);
      }

      res.json({ success: true, data: { lead } });
    } catch (error) {
      throw error;
    }
  }

  async createLead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = createLeadSchema.parse(req.body);
      const accountId = req.user!.accountId;

      const lead = await prisma.lead.create({
        data: {
          ...data,
          accountId,
        },
      });

      // Create activity
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: 'note',
          title: 'Lead created',
          description: 'Lead was added to the system',
        },
      });

      res.status(201).json({ success: true, data: { lead } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`, 400);
      }
      throw error;
    }
  }

  async updateLead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateLeadSchema.parse(req.body);
      const accountId = req.user!.accountId;

      const lead = await prisma.lead.findFirst({
        where: { id, accountId },
      });

      if (!lead) {
        throw createError('Lead not found', 404);
      }

      const updatedLead = await prisma.lead.update({
        where: { id },
        data,
      });

      res.json({ success: true, data: { lead: updatedLead } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`, 400);
      }
      throw error;
    }
  }

  async deleteLead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const accountId = req.user!.accountId;

      const lead = await prisma.lead.findFirst({
        where: { id, accountId },
      });

      if (!lead) {
        throw createError('Lead not found', 404);
      }

      await prisma.lead.delete({
        where: { id },
      });

      res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (error) {
      throw error;
    }
  }

  async qualifyLead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { score, notes } = req.body;
      const accountId = req.user!.accountId;

      const lead = await prisma.lead.findFirst({
        where: { id, accountId },
      });

      if (!lead) {
        throw createError('Lead not found', 404);
      }

      const updatedLead = await prisma.lead.update({
        where: { id },
        data: {
          score: score !== undefined ? parseInt(score, 10) : undefined,
          notes: notes || lead.notes,
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: id,
          type: 'status_change',
          title: 'Lead qualified',
          description: `Lead score updated to ${updatedLead.score}`,
        },
      });

      res.json({ success: true, data: { lead: updatedLead } });
    } catch (error) {
      throw error;
    }
  }

  async bulkUpdate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { leadIds, updates } = req.body;
      const accountId = req.user!.accountId;

      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        throw createError('leadIds must be a non-empty array', 400);
      }

      const result = await prisma.lead.updateMany({
        where: {
          id: { in: leadIds },
          accountId,
        },
        data: updates,
      });

      res.json({
        success: true,
        data: { updated: result.count },
      });
    } catch (error) {
      throw error;
    }
  }
}
