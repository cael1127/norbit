import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';
import { WorkflowService } from '../services/workflow.service';

const prisma = new PrismaClient();
const workflowService = new WorkflowService();

const createWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  definition: z.any(), // JSON schema for workflow definition
  isActive: z.boolean().default(true),
});

export class WorkflowController {
  async getWorkflows(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountId = req.user!.accountId;
      const { isActive } = req.query;

      const where: any = { accountId };
      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      const workflows = await prisma.workflow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { runs: true },
          },
        },
      });

      res.json({ success: true, data: { workflows } });
    } catch (error) {
      throw error;
    }
  }

  async getWorkflowById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const accountId = req.user!.accountId;

      const workflow = await prisma.workflow.findFirst({
        where: { id, accountId },
        include: {
          runs: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!workflow) {
        throw createError('Workflow not found', 404);
      }

      res.json({ success: true, data: { workflow } });
    } catch (error) {
      throw error;
    }
  }

  async createWorkflow(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = createWorkflowSchema.parse(req.body);
      const accountId = req.user!.accountId;

      const workflow = await prisma.workflow.create({
        data: {
          ...data,
          accountId,
        },
      });

      res.status(201).json({ success: true, data: { workflow } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`, 400);
      }
      throw error;
    }
  }

  async updateWorkflow(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = createWorkflowSchema.partial().parse(req.body);
      const accountId = req.user!.accountId;

      const workflow = await prisma.workflow.findFirst({
        where: { id, accountId },
      });

      if (!workflow) {
        throw createError('Workflow not found', 404);
      }

      const updatedWorkflow = await prisma.workflow.update({
        where: { id },
        data,
      });

      res.json({ success: true, data: { workflow: updatedWorkflow } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`, 400);
      }
      throw error;
    }
  }

  async deleteWorkflow(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const accountId = req.user!.accountId;

      const workflow = await prisma.workflow.findFirst({
        where: { id, accountId },
      });

      if (!workflow) {
        throw createError('Workflow not found', 404);
      }

      await prisma.workflow.delete({
        where: { id },
      });

      res.json({ success: true, message: 'Workflow deleted successfully' });
    } catch (error) {
      throw error;
    }
  }

  async executeWorkflow(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { leadId, input } = req.body;
      const accountId = req.user!.accountId;

      const workflow = await prisma.workflow.findFirst({
        where: { id, accountId },
      });

      if (!workflow) {
        throw createError('Workflow not found', 404);
      }

      if (!workflow.isActive) {
        throw createError('Workflow is not active', 400);
      }

      // Create workflow run
      const run = await prisma.workflowRun.create({
        data: {
          workflowId: id,
          leadId,
          status: 'pending',
          input: input || {},
        },
      });

      // Queue workflow execution
      await workflowService.executeWorkflow(run.id, workflow, input || {});

      res.status(202).json({
        success: true,
        data: { run },
        message: 'Workflow execution queued',
      });
    } catch (error) {
      throw error;
    }
  }

  async getExecutions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { page = '1', limit = '20' } = req.query;
      const accountId = req.user!.accountId;

      const workflow = await prisma.workflow.findFirst({
        where: { id, accountId },
      });

      if (!workflow) {
        throw createError('Workflow not found', 404);
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [runs, total] = await Promise.all([
        prisma.workflowRun.findMany({
          where: { workflowId: id },
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            lead: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                company: true,
              },
            },
          },
        }),
        prisma.workflowRun.count({ where: { workflowId: id } }),
      ]);

      res.json({
        success: true,
        data: {
          runs,
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
