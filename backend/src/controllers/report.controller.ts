import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export class ReportController {
  async getDashboardMetrics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountId = req.user!.accountId;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const [
        totalLeads,
        newLeads,
        qualifiedLeads,
        convertedLeads,
        scheduledMeetings,
        activeWorkflows,
        workflowRuns,
      ] = await Promise.all([
        prisma.lead.count({ where: { accountId } }),
        prisma.lead.count({
          where: {
            accountId,
            createdAt: { gte: start, lte: end },
          },
        }),
        prisma.lead.count({
          where: {
            accountId,
            status: 'qualified',
            updatedAt: { gte: start, lte: end },
          },
        }),
        prisma.lead.count({
          where: {
            accountId,
            status: 'converted',
            updatedAt: { gte: start, lte: end },
          },
        }),
        prisma.calendarEvent.count({
          where: {
            integration: { accountId },
            startTime: { gte: start, lte: end },
            status: { in: ['scheduled', 'confirmed'] },
          },
        }),
        prisma.workflow.count({
          where: { accountId, isActive: true },
        }),
        prisma.workflowRun.count({
          where: {
            workflow: { accountId },
            createdAt: { gte: start, lte: end },
          },
        }),
      ]);

      const conversionRate = newLeads > 0 ? (convertedLeads / newLeads) * 100 : 0;

      res.json({
        success: true,
        data: {
          metrics: {
            totalLeads,
            newLeads,
            qualifiedLeads,
            convertedLeads,
            scheduledMeetings,
            activeWorkflows,
            workflowRuns,
            conversionRate: Math.round(conversionRate * 100) / 100,
          },
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async getLeadReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountId = req.user!.accountId;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Lead status breakdown
      const statusBreakdown = await prisma.lead.groupBy({
        by: ['status'],
        where: {
          accountId,
          updatedAt: { gte: start, lte: end },
        },
        _count: true,
      });

      // Lead source breakdown
      const sourceBreakdown = await prisma.lead.groupBy({
        by: ['source'],
        where: {
          accountId,
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      });

      // Lead score distribution
      const scoreStats = await prisma.lead.aggregate({
        where: {
          accountId,
          updatedAt: { gte: start, lte: end },
        },
        _avg: { score: true },
        _max: { score: true },
        _min: { score: true },
      });

      res.json({
        success: true,
        data: {
          statusBreakdown,
          sourceBreakdown,
          scoreStats,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async getOutreachReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountId = req.user!.accountId;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Outreach activities
      const outreachActivities = await prisma.leadActivity.findMany({
        where: {
          lead: { accountId },
          type: { in: ['outreach', 'email'] },
          createdAt: { gte: start, lte: end },
        },
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
        orderBy: { createdAt: 'desc' },
      });

      // Activity type breakdown
      const activityBreakdown = await prisma.leadActivity.groupBy({
        by: ['type'],
        where: {
          lead: { accountId },
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      });

      res.json({
        success: true,
        data: {
          outreachActivities,
          activityBreakdown,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async getCalendarReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountId = req.user!.accountId;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const events = await prisma.calendarEvent.findMany({
        where: {
          integration: { accountId },
          startTime: { gte: start, lte: end },
        },
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
        orderBy: { startTime: 'asc' },
      });

      const statusBreakdown = await prisma.calendarEvent.groupBy({
        by: ['status'],
        where: {
          integration: { accountId },
          startTime: { gte: start, lte: end },
        },
        _count: true,
      });

      res.json({
        success: true,
        data: {
          events,
          statusBreakdown,
          totalEvents: events.length,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async getWorkflowReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountId = req.user!.accountId;
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const runs = await prisma.workflowRun.findMany({
        where: {
          workflow: { accountId },
          createdAt: { gte: start, lte: end },
        },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              company: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const statusBreakdown = await prisma.workflowRun.groupBy({
        by: ['status'],
        where: {
          workflow: { accountId },
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      });

      const successRate =
        runs.length > 0
          ? (runs.filter(r => r.status === 'completed').length / runs.length) * 100
          : 0;

      res.json({
        success: true,
        data: {
          runs,
          statusBreakdown,
          totalRuns: runs.length,
          successRate: Math.round(successRate * 100) / 100,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async exportReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      const accountId = req.user!.accountId;

      // TODO: Implement CSV/PDF export
      throw createError('Export functionality not yet implemented', 501);
    } catch (error) {
      throw error;
    }
  }
}
