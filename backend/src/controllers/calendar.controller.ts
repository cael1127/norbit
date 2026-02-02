import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { google } from 'googleapis';
import { z } from 'zod';

const prisma = new PrismaClient();

const createEventSchema = z.object({
  leadId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
  meetingLink: z.string().url().optional(),
});

export class CalendarController {
  async authorize(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountId = req.user!.accountId;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/oauth/callback';

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: accountId,
        prompt: 'consent',
      });

      res.json({ success: true, data: { authUrl } });
    } catch (error) {
      throw error;
    }
  }

  async oauthCallback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;
      const accountId = state as string || req.user!.accountId;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/oauth/callback';

      if (!code) {
        throw createError('Authorization code not provided', 400);
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code as string);

      if (!tokens.access_token) {
        throw createError('Failed to get access token', 500);
      }

      // Get calendar info
      oauth2Client.setCredentials(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const calendarList = await calendar.calendarList.list();
      const primaryCalendar = calendarList.data.items?.find(cal => cal.primary) || calendarList.data.items?.[0];

      // Store integration
      const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

      await prisma.calendarIntegration.upsert({
        where: {
          accountId_provider: {
            accountId,
            provider: 'google',
          },
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt,
          calendarId: primaryCalendar?.id || undefined,
          isActive: true,
        },
        create: {
          accountId,
          provider: 'google',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt,
          calendarId: primaryCalendar?.id || undefined,
          isActive: true,
        },
      });

      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/calendar?success=true`);
    } catch (error) {
      throw error;
    }
  }

  async getEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const accountId = req.user!.accountId;
      const { start, end } = req.query;

      const integration = await prisma.calendarIntegration.findFirst({
        where: { accountId, provider: 'google', isActive: true },
      });

      if (!integration) {
        throw createError('Calendar not connected', 404);
      }

      // Get events from database
      const events = await prisma.calendarEvent.findMany({
        where: {
          integrationId: integration.id,
          ...(start && end && {
            startTime: {
              gte: new Date(start as string),
              lte: new Date(end as string),
            },
          }),
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

      res.json({ success: true, data: { events } });
    } catch (error) {
      throw error;
    }
  }

  async createEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = createEventSchema.parse(req.body);
      const accountId = req.user!.accountId;

      const integration = await prisma.calendarIntegration.findFirst({
        where: { accountId, provider: 'google', isActive: true },
      });

      if (!integration) {
        throw createError('Calendar not connected', 404);
      }

      // Refresh token if needed
      const oauth2Client = await this.getOAuthClient(integration);

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Create Google Calendar event
      const googleEvent = await calendar.events.insert({
        calendarId: integration.calendarId || 'primary',
        requestBody: {
          summary: data.title,
          description: data.description,
          start: {
            dateTime: data.startTime,
            timeZone: 'UTC',
          },
          end: {
            dateTime: data.endTime,
            timeZone: 'UTC',
          },
          location: data.location,
          conferenceData: data.meetingLink ? {
            createRequest: {
              requestId: `orbit-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          } : undefined,
        },
      });

      // Store in database
      const event = await prisma.calendarEvent.create({
        data: {
          integrationId: integration.id,
          leadId: data.leadId,
          googleEventId: googleEvent.data.id || undefined,
          title: data.title,
          description: data.description,
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          location: data.location,
          meetingLink: data.meetingLink || googleEvent.data.hangoutLink || undefined,
        },
      });

      res.status(201).json({ success: true, data: { event } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`, 400);
      }
      throw error;
    }
  }

  async updateEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const accountId = req.user!.accountId;

      const event = await prisma.calendarEvent.findFirst({
        where: { id },
        include: { integration: true },
      });

      if (!event || event.integration.accountId !== accountId) {
        throw createError('Event not found', 404);
      }

      // TODO: Update Google Calendar event
      // TODO: Update database event

      res.json({ success: true, data: { event } });
    } catch (error) {
      throw error;
    }
  }

  async deleteEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const accountId = req.user!.accountId;

      const event = await prisma.calendarEvent.findFirst({
        where: { id },
        include: { integration: true },
      });

      if (!event || event.integration.accountId !== accountId) {
        throw createError('Event not found', 404);
      }

      // Delete from Google Calendar if exists
      if (event.googleEventId) {
        const oauth2Client = await this.getOAuthClient(event.integration);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        await calendar.events.delete({
          calendarId: event.integration.calendarId || 'primary',
          eventId: event.googleEventId,
        });
      }

      await prisma.calendarEvent.delete({
        where: { id },
      });

      res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
      throw error;
    }
  }

  async checkAvailability(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { start, end } = req.query;
      const accountId = req.user!.accountId;

      if (!start || !end) {
        throw createError('Start and end times are required', 400);
      }

      const integration = await prisma.calendarIntegration.findFirst({
        where: { accountId, provider: 'google', isActive: true },
      });

      if (!integration) {
        throw createError('Calendar not connected', 404);
      }

      // Get existing events in time range
      const existingEvents = await prisma.calendarEvent.findMany({
        where: {
          integrationId: integration.id,
          startTime: {
            gte: new Date(start as string),
            lt: new Date(end as string),
          },
          status: { in: ['scheduled', 'confirmed'] },
        },
      });

      res.json({
        success: true,
        data: {
          available: existingEvents.length === 0,
          conflictingEvents: existingEvents,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  private async getOAuthClient(integration: any): Promise<any> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.expiresAt?.getTime(),
    });

    // Refresh token if expired
    if (integration.expiresAt && integration.expiresAt < new Date()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token || integration.refreshToken,
          expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        },
      });
      oauth2Client.setCredentials(credentials);
    }

    return oauth2Client;
  }
}
