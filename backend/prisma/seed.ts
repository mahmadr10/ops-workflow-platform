import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@digitalsofts.com' },
    update: {},
    create: { email: 'admin@digitalsofts.com', name: 'Ayesha Admin', passwordHash: password, role: 'ADMIN' },
  });
  const manager = await prisma.user.upsert({
    where: { email: 'manager@digitalsofts.com' },
    update: {},
    create: { email: 'manager@digitalsofts.com', name: 'Bilal Manager', passwordHash: password, role: 'MANAGER' },
  });
  const employee = await prisma.user.upsert({
    where: { email: 'employee@digitalsofts.com' },
    update: {},
    create: { email: 'employee@digitalsofts.com', name: 'Sara Employee', passwordHash: password, role: 'EMPLOYEE' },
  });
  const readonly = await prisma.user.upsert({
    where: { email: 'viewer@digitalsofts.com' },
    update: {},
    create: { email: 'viewer@digitalsofts.com', name: 'Ali Viewer', passwordHash: password, role: 'READONLY' },
  });

  // Recruitment workflow
  const recruitment = await prisma.workflow.upsert({
    where: { key: 'recruitment' },
    update: {},
    create: {
      key: 'recruitment',
      name: 'Recruitment',
      description: 'Candidate hiring pipeline',
      createdById: admin.id,
      statuses: {
        create: [
          { name: 'Applied', order: 0, color: '#64748b' },
          { name: 'Screening', order: 1, color: '#3b82f6' },
          { name: 'Assignment', order: 2, color: '#8b5cf6' },
          { name: 'Interview', order: 3, color: '#f59e0b' },
          { name: 'Offer', order: 4, color: '#ec4899' },
          { name: 'Hired', order: 5, color: '#22c55e', isTerminal: true, isSuccess: true },
          { name: 'Rejected', order: 6, color: '#ef4444', isTerminal: true, isSuccess: false },
        ],
      },
    },
  });

  // Sales pipeline workflow
  const sales = await prisma.workflow.upsert({
    where: { key: 'sales' },
    update: {},
    create: {
      key: 'sales',
      name: 'Sales Pipeline',
      description: 'Lead to won/lost pipeline',
      createdById: admin.id,
      statuses: {
        create: [
          { name: 'Lead', order: 0, color: '#64748b' },
          { name: 'Qualified', order: 1, color: '#3b82f6' },
          { name: 'Proposal', order: 2, color: '#8b5cf6' },
          { name: 'Negotiation', order: 3, color: '#f59e0b' },
          { name: 'Won', order: 4, color: '#22c55e', isTerminal: true, isSuccess: true },
          { name: 'Lost', order: 5, color: '#ef4444', isTerminal: true, isSuccess: false },
        ],
      },
    },
  });

  // Internal tasks workflow
  const tasks = await prisma.workflow.upsert({
    where: { key: 'tasks' },
    update: {},
    create: {
      key: 'tasks',
      name: 'Internal Tasks',
      description: 'Engineering / operations task board',
      createdById: admin.id,
      statuses: {
        create: [
          { name: 'Todo', order: 0, color: '#64748b' },
          { name: 'In Progress', order: 1, color: '#3b82f6' },
          { name: 'Review', order: 2, color: '#8b5cf6' },
          { name: 'Testing', order: 3, color: '#f59e0b' },
          { name: 'Completed', order: 4, color: '#22c55e', isTerminal: true, isSuccess: true },
        ],
      },
    },
  });

  const urgentLabel = await prisma.label.upsert({ where: { name: 'urgent' }, update: {}, create: { name: 'urgent', color: '#ef4444' } });
  await prisma.label.upsert({ where: { name: 'remote' }, update: {}, create: { name: 'remote', color: '#3b82f6' } });

  const recruitmentStatuses = await prisma.workflowStatus.findMany({ where: { workflowId: recruitment.id }, orderBy: { order: 'asc' } });
  const salesStatuses = await prisma.workflowStatus.findMany({ where: { workflowId: sales.id }, orderBy: { order: 'asc' } });
  const taskStatuses = await prisma.workflowStatus.findMany({ where: { workflowId: tasks.id }, orderBy: { order: 'asc' } });

  const nineDaysAgo = new Date();
  nineDaysAgo.setDate(nineDaysAgo.getDate() - 9);

  const candidate = await prisma.item.create({
    data: {
      workflowId: recruitment.id,
      statusId: recruitmentStatuses[3].id, // Interview
      title: 'Hamza Khan - Senior Backend Engineer',
      description: 'Strong Node.js and PostgreSQL background, 6 years experience.',
      priority: 'HIGH',
      assigneeId: manager.id,
      createdById: admin.id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      statusEnteredAt: nineDaysAgo,
      riskScore: 72,
      customFields: { source: 'LinkedIn', expectedSalary: '250,000 PKR' },
      labels: { create: [{ labelId: urgentLabel.id }] },
    },
  });

  await prisma.item.create({
    data: {
      workflowId: sales.id,
      statusId: salesStatuses[2].id, // Proposal
      title: 'Acme Corp - ERP Implementation Deal',
      description: 'Mid-market client evaluating our ERP suite for 200 seats.',
      priority: 'CRITICAL',
      assigneeId: employee.id,
      createdById: manager.id,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      riskScore: 45,
      customFields: { dealValue: '$45,000', region: 'North America' },
    },
  });

  await prisma.item.create({
    data: {
      workflowId: tasks.id,
      statusId: taskStatuses[1].id, // In Progress
      title: 'Build AI risk scoring module',
      description: 'Implement daily risk score recomputation cron job.',
      priority: 'MEDIUM',
      assigneeId: employee.id,
      createdById: admin.id,
      customFields: {},
    },
  });

  await prisma.item.create({
    data: {
      workflowId: tasks.id,
      statusId: taskStatuses[4].id, // Completed
      title: 'Set up CI pipeline',
      description: 'GitHub Actions for lint, build, and test.',
      priority: 'LOW',
      assigneeId: manager.id,
      createdById: admin.id,
      customFields: {},
    },
  });

  await prisma.reminderRule.create({
    data: {
      workflowId: recruitment.id,
      statusId: recruitmentStatuses[3].id, // Interview
      daysInStatus: 3,
      message: 'Candidate has been waiting in Interview stage for 3+ days. Please schedule or follow up.',
      channels: ['WEBHOOK'],
    },
  });

  await prisma.activityLog.create({
    data: { itemId: candidate.id, actorId: admin.id, action: 'CREATED', toValue: candidate.title },
  });
  await prisma.activityLog.create({
    data: { itemId: candidate.id, actorId: manager.id, action: 'STATUS_CHANGED', fromValue: 'Screening', toValue: 'Interview' },
  });

  console.log('Seed complete.');
  console.log('Demo credentials (all use password: Password123!)');
  console.log(' Admin:    admin@digitalsofts.com');
  console.log(' Manager:  manager@digitalsofts.com');
  console.log(' Employee: employee@digitalsofts.com');
  console.log(' Readonly: viewer@digitalsofts.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
