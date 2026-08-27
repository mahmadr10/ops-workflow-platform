import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@digitalsofts.com' },
    update: {},
    create: { email: 'admin@digitalsofts.com', name: 'M. Ahmad Admin', passwordHash: password, role: 'ADMIN' },
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
  await prisma.user.upsert({
    where: { email: 'viewer@digitalsofts.com' },
    update: {},
    create: { email: 'viewer@digitalsofts.com', name: 'Ali Viewer', passwordHash: password, role: 'READONLY' },
  });

  // ---- Recruitment ----
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

  // ---- Sales Pipeline ----
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

  // ---- Internal Tasks ----
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

  // ---- Client Projects ----
  const projects = await prisma.workflow.upsert({
    where: { key: 'client-projects' },
    update: {},
    create: {
      key: 'client-projects',
      name: 'Client Projects',
      description: 'Delivery pipeline for client engagements',
      createdById: admin.id,
      statuses: {
        create: [
          { name: 'Kickoff', order: 0, color: '#64748b' },
          { name: 'Planning', order: 1, color: '#3b82f6' },
          { name: 'In Development', order: 2, color: '#8b5cf6' },
          { name: 'QA', order: 3, color: '#f59e0b' },
          { name: 'Delivered', order: 4, color: '#22c55e', isTerminal: true, isSuccess: true },
          { name: 'Cancelled', order: 5, color: '#ef4444', isTerminal: true, isSuccess: false },
        ],
      },
    },
  });

  // ---- Procurement ----
  const procurement = await prisma.workflow.upsert({
    where: { key: 'procurement' },
    update: {},
    create: {
      key: 'procurement',
      name: 'Procurement',
      description: 'Purchase request approval pipeline',
      createdById: admin.id,
      statuses: {
        create: [
          { name: 'Requested', order: 0, color: '#64748b' },
          { name: 'Approved', order: 1, color: '#3b82f6' },
          { name: 'Ordered', order: 2, color: '#f59e0b' },
          { name: 'Received', order: 3, color: '#22c55e', isTerminal: true, isSuccess: true },
          { name: 'Rejected', order: 4, color: '#ef4444', isTerminal: true, isSuccess: false },
        ],
      },
    },
  });

  const urgentLabel = await prisma.label.upsert({ where: { name: 'urgent' }, update: {}, create: { name: 'urgent', color: '#ef4444' } });
  const remoteLabel = await prisma.label.upsert({ where: { name: 'remote' }, update: {}, create: { name: 'remote', color: '#3b82f6' } });
  const vipLabel = await prisma.label.upsert({ where: { name: 'vip-client' }, update: {}, create: { name: 'vip-client', color: '#f59e0b' } });

  const recruitmentStatuses = await prisma.workflowStatus.findMany({ where: { workflowId: recruitment.id }, orderBy: { order: 'asc' } });
  const salesStatuses = await prisma.workflowStatus.findMany({ where: { workflowId: sales.id }, orderBy: { order: 'asc' } });
  const taskStatuses = await prisma.workflowStatus.findMany({ where: { workflowId: tasks.id }, orderBy: { order: 'asc' } });
  const projectStatuses = await prisma.workflowStatus.findMany({ where: { workflowId: projects.id }, orderBy: { order: 'asc' } });
  const procurementStatuses = await prisma.workflowStatus.findMany({ where: { workflowId: procurement.id }, orderBy: { order: 'asc' } });

  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };
  const daysFromNow = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };

  // ---- Recruitment items (one per status, so every column has a card) ----
  const candidate = await prisma.item.create({
    data: {
      workflowId: recruitment.id,
      statusId: recruitmentStatuses[3].id, // Interview
      title: 'Hamza Khan - Senior Backend Engineer',
      description: 'Strong Node.js and PostgreSQL background, 6 years experience.',
      priority: 'HIGH',
      assigneeId: manager.id,
      createdById: admin.id,
      dueDate: daysFromNow(3),
      statusEnteredAt: daysAgo(9),
      riskScore: 72,
      customFields: { source: 'LinkedIn', expectedSalary: '250,000 PKR' },
      labels: { create: [{ labelId: urgentLabel.id }] },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: recruitment.id,
      statusId: recruitmentStatuses[0].id, // Applied
      title: 'Noor Fatima - UI/UX Designer',
      description: 'Portfolio shows strong Figma and design systems work.',
      priority: 'MEDIUM',
      assigneeId: employee.id,
      createdById: admin.id,
      customFields: { source: 'Referral' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: recruitment.id,
      statusId: recruitmentStatuses[1].id, // Screening
      title: 'Usman Tariq - DevOps Engineer',
      description: 'Kubernetes and Terraform experience, screening call pending.',
      priority: 'MEDIUM',
      assigneeId: manager.id,
      createdById: manager.id,
      customFields: { source: 'Indeed' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: recruitment.id,
      statusId: recruitmentStatuses[4].id, // Offer
      title: 'Zainab Malik - QA Automation Lead',
      description: 'Offer sent, awaiting response.',
      priority: 'HIGH',
      assigneeId: manager.id,
      createdById: admin.id,
      dueDate: daysFromNow(2),
      customFields: { source: 'LinkedIn', offeredSalary: '300,000 PKR' },
      labels: { create: [{ labelId: remoteLabel.id }] },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: recruitment.id,
      statusId: recruitmentStatuses[5].id, // Hired
      title: 'Ahmed Raza - Backend Intern',
      description: 'Accepted offer, starting next Monday.',
      priority: 'LOW',
      assigneeId: employee.id,
      createdById: admin.id,
      customFields: { source: 'University Fair' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: recruitment.id,
      statusId: recruitmentStatuses[6].id, // Rejected
      title: 'Bilal Sheikh - Frontend Developer',
      description: 'Did not meet technical bar in final round.',
      priority: 'LOW',
      assigneeId: employee.id,
      createdById: manager.id,
      customFields: { source: 'LinkedIn' },
    },
  });

  // ---- Sales items ----
  await prisma.item.create({
    data: {
      workflowId: sales.id,
      statusId: salesStatuses[2].id, // Proposal
      title: 'Acme Corp - ERP Implementation Deal',
      description: 'Mid-market client evaluating our ERP suite for 200 seats.',
      priority: 'CRITICAL',
      assigneeId: employee.id,
      createdById: manager.id,
      dueDate: daysFromNow(1),
      riskScore: 45,
      customFields: { dealValue: '$45,000', region: 'North America' },
      labels: { create: [{ labelId: vipLabel.id }] },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: sales.id,
      statusId: salesStatuses[0].id, // Lead
      title: 'Northwind Traders - Inbound inquiry',
      description: 'Requested a demo via the website contact form.',
      priority: 'LOW',
      assigneeId: employee.id,
      createdById: employee.id,
      customFields: { dealValue: '$8,000', region: 'Europe' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: sales.id,
      statusId: salesStatuses[1].id, // Qualified
      title: 'Contoso Ltd - HR Suite Upgrade',
      description: 'Budget confirmed, technical evaluation in progress.',
      priority: 'MEDIUM',
      assigneeId: manager.id,
      createdById: manager.id,
      customFields: { dealValue: '$22,000', region: 'Middle East' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: sales.id,
      statusId: salesStatuses[3].id, // Negotiation
      title: 'Globex Inc - Multi-year Support Contract',
      description: 'Discussing pricing tiers and SLA terms.',
      priority: 'HIGH',
      assigneeId: manager.id,
      createdById: admin.id,
      dueDate: daysFromNow(5),
      customFields: { dealValue: '$120,000', region: 'North America' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: sales.id,
      statusId: salesStatuses[4].id, // Won
      title: 'Initech - Payroll Module License',
      description: 'Contract signed, handing off to onboarding.',
      priority: 'MEDIUM',
      assigneeId: employee.id,
      createdById: manager.id,
      customFields: { dealValue: '$15,000', region: 'Asia Pacific' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: sales.id,
      statusId: salesStatuses[5].id, // Lost
      title: 'Umbrella Co - Chose a competitor',
      description: 'Lost on price, follow up again next fiscal year.',
      priority: 'LOW',
      assigneeId: employee.id,
      createdById: employee.id,
      customFields: { dealValue: '$30,000', region: 'Europe' },
    },
  });

  // ---- Internal Tasks items ----
  await prisma.item.create({
    data: {
      workflowId: tasks.id,
      statusId: taskStatuses[0].id, // Todo
      title: 'Write API rate limit documentation',
      description: 'Document the rate limiting rules for external integrators.',
      priority: 'LOW',
      assigneeId: employee.id,
      createdById: admin.id,
      customFields: {},
    },
  });
  await prisma.item.create({
    data: {
      workflowId: tasks.id,
      statusId: taskStatuses[1].id, // In Progress
      title: 'Build AI risk scoring module',
      description: 'Implement hourly risk score recomputation cron job.',
      priority: 'MEDIUM',
      assigneeId: employee.id,
      createdById: admin.id,
      customFields: {},
    },
  });
  await prisma.item.create({
    data: {
      workflowId: tasks.id,
      statusId: taskStatuses[2].id, // Review
      title: 'Code review: notification adapters',
      description: 'Review Slack and Discord webhook integration PR.',
      priority: 'MEDIUM',
      assigneeId: manager.id,
      createdById: employee.id,
      customFields: {},
    },
  });
  await prisma.item.create({
    data: {
      workflowId: tasks.id,
      statusId: taskStatuses[3].id, // Testing
      title: 'Load test the dashboard endpoint',
      description: 'Verify dashboard queries stay fast with 10k+ items.',
      priority: 'HIGH',
      assigneeId: employee.id,
      createdById: manager.id,
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

  // ---- Client Projects items ----
  await prisma.item.create({
    data: {
      workflowId: projects.id,
      statusId: projectStatuses[0].id, // Kickoff
      title: 'Contoso Website Redesign',
      description: 'Initial kickoff call scheduled with stakeholders.',
      priority: 'MEDIUM',
      assigneeId: manager.id,
      createdById: admin.id,
      customFields: { client: 'Contoso Ltd', budget: '$18,000' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: projects.id,
      statusId: projectStatuses[1].id, // Planning
      title: 'Acme Mobile App - Sprint Planning',
      description: 'Breaking down requirements into a 6-sprint roadmap.',
      priority: 'MEDIUM',
      assigneeId: employee.id,
      createdById: manager.id,
      customFields: { client: 'Acme Corp', budget: '$60,000' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: projects.id,
      statusId: projectStatuses[2].id, // In Development
      title: 'Globex ERP Integration',
      description: 'Building the custom API connector for their legacy system.',
      priority: 'HIGH',
      assigneeId: employee.id,
      createdById: admin.id,
      dueDate: daysFromNow(10),
      statusEnteredAt: daysAgo(6),
      riskScore: 55,
      customFields: { client: 'Globex Inc', budget: '$120,000' },
      labels: { create: [{ labelId: vipLabel.id }] },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: projects.id,
      statusId: projectStatuses[3].id, // QA
      title: 'Initech Payroll Module - Final QA',
      description: 'Regression testing before go-live.',
      priority: 'HIGH',
      assigneeId: manager.id,
      createdById: employee.id,
      dueDate: daysFromNow(2),
      customFields: { client: 'Initech', budget: '$15,000' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: projects.id,
      statusId: projectStatuses[4].id, // Delivered
      title: 'Northwind Landing Page',
      description: 'Delivered and signed off by client.',
      priority: 'LOW',
      assigneeId: employee.id,
      createdById: admin.id,
      customFields: { client: 'Northwind Traders', budget: '$4,500' },
    },
  });

  // ---- Procurement items ----
  await prisma.item.create({
    data: {
      workflowId: procurement.id,
      statusId: procurementStatuses[0].id, // Requested
      title: '10x Developer Laptops',
      description: 'New hires onboarding next month need hardware.',
      priority: 'MEDIUM',
      assigneeId: admin.id,
      createdById: manager.id,
      customFields: { estimatedCost: '$12,000', vendor: 'Dell Business' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: procurement.id,
      statusId: procurementStatuses[1].id, // Approved
      title: 'Annual Figma Team License',
      description: 'Approved by finance, awaiting order placement.',
      priority: 'LOW',
      assigneeId: admin.id,
      createdById: employee.id,
      customFields: { estimatedCost: '$1,200', vendor: 'Figma Inc' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: procurement.id,
      statusId: procurementStatuses[2].id, // Ordered
      title: 'Office Standing Desks (x6)',
      description: 'Order placed, delivery expected in 2 weeks.',
      priority: 'LOW',
      assigneeId: manager.id,
      createdById: admin.id,
      dueDate: daysFromNow(14),
      customFields: { estimatedCost: '$3,000', vendor: 'ErgoFit' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: procurement.id,
      statusId: procurementStatuses[3].id, // Received
      title: 'AWS Reserved Instance Renewal',
      description: 'Received and applied to the account.',
      priority: 'MEDIUM',
      assigneeId: admin.id,
      createdById: manager.id,
      customFields: { estimatedCost: '$5,400', vendor: 'AWS' },
    },
  });
  await prisma.item.create({
    data: {
      workflowId: procurement.id,
      statusId: procurementStatuses[4].id, // Rejected
      title: 'Premium Conference Room TVs',
      description: 'Rejected by finance this quarter, revisit next budget cycle.',
      priority: 'LOW',
      assigneeId: manager.id,
      createdById: employee.id,
      customFields: { estimatedCost: '$6,000', vendor: 'Samsung' },
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
  console.log('5 workflows seeded: Recruitment, Sales Pipeline, Internal Tasks, Client Projects, Procurement');
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
