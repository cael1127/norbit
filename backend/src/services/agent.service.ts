import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { getSocketInstance } from '../socket/manager';
import { LeadService } from './lead.service';
import { CalendarService } from './calendar.service';

const prisma = new PrismaClient();
const leadService = new LeadService();
const calendarService = new CalendarService();

interface AgentTool {
  name: string;
  description: string;
  parameters: any;
}

export class AgentService {
  private openai: OpenAI;
  private tools: AgentTool[];

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    this.openai = new OpenAI({ apiKey });

    this.tools = [
      {
        name: 'discover_leads',
        description: 'Search for potential leads based on criteria (company name, industry, location, etc.)',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for finding leads',
            },
            industry: {
              type: 'string',
              description: 'Industry filter',
            },
            location: {
              type: 'string',
              description: 'Location filter',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'send_outreach',
        description: 'Send an outreach message to a lead',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'ID of the lead to contact',
            },
            message: {
              type: 'string',
              description: 'Outreach message content',
            },
            channel: {
              type: 'string',
              enum: ['email', 'linkedin', 'phone'],
              description: 'Communication channel',
            },
          },
          required: ['leadId', 'message', 'channel'],
        },
      },
      {
        name: 'qualify_lead',
        description: 'Assess and score a lead based on qualification criteria',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'ID of the lead to qualify',
            },
            criteria: {
              type: 'object',
              description: 'Qualification criteria and responses',
            },
          },
          required: ['leadId'],
        },
      },
      {
        name: 'schedule_meeting',
        description: 'Schedule a calendar meeting with a lead',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'ID of the lead',
            },
            title: {
              type: 'string',
              description: 'Meeting title',
            },
            duration: {
              type: 'number',
              description: 'Meeting duration in minutes',
              default: 30,
            },
            preferredTime: {
              type: 'string',
              description: 'Preferred meeting time (ISO string)',
            },
          },
          required: ['leadId', 'title'],
        },
      },
      {
        name: 'update_lead_status',
        description: 'Update the status of a lead in the CRM',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'ID of the lead',
            },
            status: {
              type: 'string',
              enum: ['new', 'contacted', 'qualified', 'scheduled', 'converted', 'lost'],
              description: 'New status for the lead',
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the status change',
            },
          },
          required: ['leadId', 'status'],
        },
      },
    ];
  }

  async processMessage(
    conversationId: string,
    message: string,
    accountId: string
  ): Promise<AsyncGenerator<string, void, unknown>> {
    // Get conversation history
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, accountId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20, // Last 20 messages for context
        },
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Build messages array for OpenAI
    const messages: any[] = [
      {
        role: 'system',
        content: `You are Orbit, an AI agent that helps automate lead discovery, outreach, qualification, and scheduling for small businesses. 
You have access to tools that allow you to:
- Discover new leads
- Send outreach messages
- Qualify leads
- Schedule meetings
- Update lead status

Be proactive and helpful. When a user asks you to do something, use the appropriate tools to accomplish the task.`,
      },
      ...conversation.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    // Call OpenAI with streaming
    const stream = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages,
      tools: this.tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: 'auto',
      stream: true,
    });

    let fullResponse = '';
    let toolCalls: any[] = [];

    // Process stream
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        fullResponse += delta.content;
        yield delta.content;
      }

      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;
          if (!toolCalls[index]) {
            toolCalls[index] = {
              id: toolCall.id,
              type: toolCall.type,
              function: {
                name: toolCall.function?.name || '',
                arguments: toolCall.function?.arguments || '',
              },
            };
          } else {
            toolCalls[index].function.arguments += toolCall.function?.arguments || '';
          }
        }
      }
    }

    // Save assistant message
    if (fullResponse) {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'assistant',
          content: fullResponse,
          metadata: toolCalls.length > 0 ? { toolCalls } : undefined,
        },
      });
    }

    // Execute tool calls
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        try {
          const result = await this.executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            accountId
          );

          // Send tool result back to OpenAI for final response
          const toolMessages = [
            {
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            },
          ];

          // Get final response from OpenAI about the tool execution
          const finalResponse = await this.openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
            messages: [
              ...messages,
              {
                role: 'assistant',
                content: fullResponse,
                tool_calls: toolCalls.map((tc) => ({
                  id: tc.id,
                  type: 'function',
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                })),
              },
              ...toolMessages,
            ],
            stream: true,
          });

          let toolResponse = '';
          for await (const chunk of finalResponse) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              toolResponse += delta.content;
              yield delta.content;
            }
          }

          if (toolResponse) {
            await prisma.message.create({
              data: {
                conversationId,
                role: 'assistant',
                content: toolResponse,
                metadata: { toolCall: toolCall.function.name, result },
              },
            });
          }
        } catch (error: any) {
          yield `\n\nError executing ${toolCall.function.name}: ${error.message}\n\n`;
        }
      }
    }

    // Emit to socket
    const io = getSocketInstance();
    io.to(`conversation:${conversationId}`).emit('message:complete', {
      conversationId,
      response: fullResponse,
    });
  }

  private async executeTool(name: string, args: any, accountId: string): Promise<any> {
    switch (name) {
      case 'discover_leads':
        return await leadService.discoverLeads(args.query, accountId, args);

      case 'send_outreach':
        return await leadService.sendOutreach(args.leadId, args.message, args.channel, accountId);

      case 'qualify_lead':
        return await leadService.qualifyLead(args.leadId, args.criteria, accountId);

      case 'schedule_meeting':
        return await calendarService.scheduleMeeting(
          args.leadId,
          args.title,
          args.duration || 30,
          args.preferredTime,
          accountId
        );

      case 'update_lead_status':
        return await leadService.updateLeadStatus(args.leadId, args.status, args.notes, accountId);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
