import { PrismaClient } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const prisma = new PrismaClient();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const workflowQueue = new Queue('workflows', {
  connection: redis,
});

export class WorkflowService {
  constructor() {
    this.initializeWorker();
  }

  async executeWorkflow(runId: string, workflow: any, input: any): Promise<void> {
    await workflowQueue.add(
      'execute',
      {
        runId,
        workflowId: workflow.id,
        definition: workflow.definition,
        input,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
  }

  private initializeWorker(): void {
    const worker = new Worker(
      'workflows',
      async (job) => {
        const { runId, workflowId, definition, input } = job.data;

        // Update run status
        await prisma.workflowRun.update({
          where: { id: runId },
          data: {
            status: 'running',
            startedAt: new Date(),
          },
        });

        try {
          // Execute workflow steps
          const output = await this.executeWorkflowSteps(definition, input, workflowId);

          // Update run as completed
          await prisma.workflowRun.update({
            where: { id: runId },
            data: {
              status: 'completed',
              completedAt: new Date(),
              output,
            },
          });
        } catch (error: any) {
          // Update run as failed
          await prisma.workflowRun.update({
            where: { id: runId },
            data: {
              status: 'failed',
              completedAt: new Date(),
              error: error.message,
            },
          });
          throw error;
        }
      },
      {
        connection: redis,
        concurrency: 5,
      }
    );

    worker.on('completed', (job) => {
      console.log(`Workflow ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`Workflow ${job?.id} failed:`, err);
    });
  }

  private async executeWorkflowSteps(
    definition: any,
    input: any,
    workflowId: string
  ): Promise<any> {
    const { trigger, actions } = definition;
    const results: any[] = [];

    // Execute trigger condition check
    if (trigger) {
      const triggerResult = await this.evaluateTrigger(trigger, input);
      if (!triggerResult) {
        return { success: false, reason: 'Trigger condition not met' };
      }
    }

    // Execute actions
    for (const action of actions || []) {
      const result = await this.executeAction(action, input, workflowId);
      results.push(result);

      // Handle conditional logic
      if (action.condition) {
        const conditionMet = this.evaluateCondition(action.condition, result);
        if (!conditionMet && action.onFalse) {
          // Execute alternative action
          const altResult = await this.executeAction(action.onFalse, input, workflowId);
          results.push(altResult);
        }
      }

      // Handle delays
      if (action.delay) {
        await new Promise((resolve) => setTimeout(resolve, action.delay * 1000));
      }
    }

    return { success: true, results };
  }

  private async evaluateTrigger(trigger: any, input: any): Promise<boolean> {
    switch (trigger.type) {
      case 'lead_created':
        return true; // Always true if workflow is triggered
      case 'time_based':
        // Check if current time matches schedule
        return true;
      case 'event_based':
        // Check if event matches
        return true;
      default:
        return true;
    }
  }

  private async executeAction(action: any, input: any, workflowId: string): Promise<any> {
    switch (action.type) {
      case 'send_email':
        return await this.sendEmail(action, input, workflowId);

      case 'update_lead':
        return await this.updateLead(action, input, workflowId);

      case 'create_task':
        return await this.createTask(action, input, workflowId);

      case 'wait':
        await new Promise((resolve) => setTimeout(resolve, (action.duration || 0) * 1000));
        return { success: true, type: 'wait' };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async sendEmail(action: any, input: any, workflowId: string): Promise<any> {
    // TODO: Implement email sending
    // - Use Resend, SendGrid, or AWS SES
    // - Load email template
    // - Send email

    return {
      success: true,
      type: 'send_email',
      message: 'Email sent',
    };
  }

  private async updateLead(action: any, input: any, workflowId: string): Promise<any> {
    const { leadId, updates } = action;

    if (!leadId && input.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: input.leadId },
      });

      if (lead) {
        await prisma.lead.update({
          where: { id: input.leadId },
          data: updates,
        });
      }
    }

    return {
      success: true,
      type: 'update_lead',
      message: 'Lead updated',
    };
  }

  private async createTask(action: any, input: any, workflowId: string): Promise<any> {
    // TODO: Implement task creation
    return {
      success: true,
      type: 'create_task',
      message: 'Task created',
    };
  }

  private evaluateCondition(condition: any, result: any): boolean {
    // Simple condition evaluation
    // TODO: Implement more complex condition logic
    return true;
  }
}
