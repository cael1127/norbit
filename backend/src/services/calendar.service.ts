import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { addMinutes } from 'date-fns';

const prisma = new PrismaClient();

export class CalendarService {
  async scheduleMeeting(
    leadId: string,
    title: string,
    duration: number,
    preferredTime: string | undefined,
    accountId: string
  ): Promise<any> {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, accountId },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const integration = await prisma.calendarIntegration.findFirst({
      where: { accountId, provider: 'google', isActive: true },
    });

    if (!integration) {
      throw new Error('Calendar not connected');
    }

    // Determine meeting time
    let startTime: Date;
    if (preferredTime) {
      startTime = new Date(preferredTime);
    } else {
      // Find next available slot
      startTime = await this.findNextAvailableSlot(integration.id, duration);
    }

    const endTime = addMinutes(startTime, duration);

    // Create calendar event
    const oauth2Client = await this.getOAuthClient(integration);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const googleEvent = await calendar.events.insert({
      calendarId: integration.calendarId || 'primary',
      requestBody: {
        summary: title,
        description: `Meeting with ${lead.firstName || ''} ${lead.lastName || ''} from ${lead.company || 'Unknown'}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: lead.email ? [{ email: lead.email }] : undefined,
        conferenceData: {
          createRequest: {
            requestId: `orbit-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    // Store in database
    const event = await prisma.calendarEvent.create({
      data: {
        integrationId: integration.id,
        leadId,
        googleEventId: googleEvent.data.id || undefined,
        title,
        description: googleEvent.data.description || undefined,
        startTime,
        endTime,
        meetingLink: googleEvent.data.hangoutLink || undefined,
        status: 'scheduled',
      },
    });

    // Update lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'scheduled' },
    });

    // Create activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: 'meeting',
        title: 'Meeting scheduled',
        description: `Meeting "${title}" scheduled for ${startTime.toLocaleString()}`,
        metadata: { eventId: event.id, meetingLink: event.meetingLink },
      },
    });

    return {
      success: true,
      event: {
        id: event.id,
        title: event.title,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        meetingLink: event.meetingLink,
      },
      leadId,
    };
  }

  private async findNextAvailableSlot(
    integrationId: string,
    duration: number
  ): Promise<Date> {
    const now = new Date();
    let candidateTime = new Date(now);
    candidateTime.setHours(9, 0, 0, 0); // Start at 9 AM

    // If it's past 5 PM, start tomorrow
    if (candidateTime.getHours() >= 17) {
      candidateTime.setDate(candidateTime.getDate() + 1);
      candidateTime.setHours(9, 0, 0, 0);
    }

    // Check availability for next 7 days
    for (let day = 0; day < 7; day++) {
      for (let hour = 9; hour < 17; hour++) {
        candidateTime.setHours(hour, 0, 0, 0);
        candidateTime.setDate(now.getDate() + day);

        const endTime = addMinutes(candidateTime, duration);

        const conflicting = await prisma.calendarEvent.findFirst({
          where: {
            integrationId,
            startTime: { lt: endTime },
            endTime: { gt: candidateTime },
            status: { in: ['scheduled', 'confirmed'] },
          },
        });

        if (!conflicting) {
          return candidateTime;
        }
      }
    }

    // Default: 1 hour from now
    return addMinutes(now, 60);
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

    // Refresh if expired
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
