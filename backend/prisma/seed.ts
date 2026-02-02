import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo account
  const account = await prisma.account.create({
    data: {
      name: 'Demo Account',
      plan: 'pro',
    },
  });

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'demo@orbitplatform.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      accountId: account.id,
      role: 'admin',
    },
  });

  // Create sample leads
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        accountId: account.id,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Example Corp',
        title: 'CEO',
        status: 'new',
        score: 75,
        source: 'web_search',
      },
    }),
    prisma.lead.create({
      data: {
        accountId: account.id,
        email: 'jane.smith@startup.io',
        firstName: 'Jane',
        lastName: 'Smith',
        company: 'Startup Inc',
        title: 'Founder',
        status: 'contacted',
        score: 85,
        source: 'linkedin',
      },
    }),
  ]);

  // Create sample workflow
  const workflow = await prisma.workflow.create({
    data: {
      accountId: account.id,
      name: 'New Lead Follow-up',
      description: 'Automatically send follow-up email to new leads',
      isActive: true,
      definition: {
        trigger: {
          type: 'lead_created',
          conditions: {
            status: 'new',
          },
        },
        actions: [
          {
            type: 'send_email',
            template: 'welcome',
            delay: 3600, // 1 hour
          },
        ],
      },
    },
  });

  console.log('✅ Seeding completed!');
  console.log(`   Account ID: ${account.id}`);
  console.log(`   User: ${user.email} / demo123`);
  console.log(`   Leads created: ${leads.length}`);
  console.log(`   Workflows created: 1`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
