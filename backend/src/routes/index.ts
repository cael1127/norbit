import { Express } from 'express';
import { authRoutes } from './auth.routes';
import { leadRoutes } from './lead.routes';
import { conversationRoutes } from './conversation.routes';
import { calendarRoutes } from './calendar.routes';
import { workflowRoutes } from './workflow.routes';
import { reportRoutes } from './report.routes';

export function initializeRoutes(app: Express): void {
  app.use('/api/auth', authRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/workflows', workflowRoutes);
  app.use('/api/reports', reportRoutes);
}
