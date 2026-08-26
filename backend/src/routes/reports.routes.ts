import { Router } from 'express';
import { Parser as CsvParser } from 'json2csv';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { aiService } from '../services/ai.service';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

async function fetchItemsForReport(range?: 'week' | 'month') {
  const where: any = {};
  if (range) {
    const since = new Date();
    since.setDate(since.getDate() - (range === 'week' ? 7 : 30));
    where.updatedAt = { gte: since };
  }
  return prisma.item.findMany({
    where,
    include: { status: true, workflow: true, assignee: true },
    orderBy: { updatedAt: 'desc' },
  });
}

function flatten(items: Awaited<ReturnType<typeof fetchItemsForReport>>) {
  return items.map((i) => ({
    id: i.id,
    title: i.title,
    workflow: i.workflow.name,
    status: i.status.name,
    priority: i.priority,
    assignee: i.assignee?.name || 'Unassigned',
    riskScore: i.riskScore,
    dueDate: i.dueDate?.toISOString().slice(0, 10) || '',
    createdAt: i.createdAt.toISOString().slice(0, 10),
    updatedAt: i.updatedAt.toISOString().slice(0, 10),
  }));
}

// GET /api/reports/export.csv
reportsRouter.get(
  '/export.csv',
  asyncHandler(async (req, res) => {
    const items = flatten(await fetchItemsForReport(req.query.range as 'week' | 'month' | undefined));
    const csv = new CsvParser().parse(items);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
    res.send(csv);
  })
);

// GET /api/reports/export.xlsx
reportsRouter.get(
  '/export.xlsx',
  asyncHandler(async (req, res) => {
    const items = flatten(await fetchItemsForReport(req.query.range as 'week' | 'month' | undefined));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');
    if (items.length) {
      sheet.columns = Object.keys(items[0]).map((key) => ({ header: key, key, width: 20 }));
      sheet.addRows(items);
      sheet.getRow(1).font = { bold: true };
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="report.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  })
);

// GET /api/reports/export.pdf
reportsRouter.get(
  '/export.pdf',
  asyncHandler(async (req, res) => {
    const items = flatten(await fetchItemsForReport(req.query.range as 'week' | 'month' | undefined));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(18).text('Operations Report', { underline: true });
    doc.moveDown();
    doc.fontSize(10).fillColor('#555').text(`Generated ${new Date().toLocaleString()} - ${items.length} items`);
    doc.moveDown();

    items.forEach((item) => {
      doc
        .fontSize(11)
        .fillColor('#000')
        .text(`${item.title}`, { continued: false })
        .fontSize(9)
        .fillColor('#444')
        .text(`Workflow: ${item.workflow}  |  Status: ${item.status}  |  Priority: ${item.priority}  |  Assignee: ${item.assignee}  |  Risk: ${item.riskScore}`)
        .moveDown(0.5);
    });
    doc.end();
  })
);

// GET /api/reports/summary?range=week|month - AI Executive Summary for the period
reportsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const range = (req.query.range as 'week' | 'month') || 'week';
    const items = await fetchItemsForReport(range);
    const completed = items.filter((i) => i.status.isTerminal && i.status.isSuccess).length;
    const blocked = items.filter((i) => i.riskScore >= 60).length;
    const stats = { range, totalUpdated: items.length, completed, blocked };
    const summary = await aiService.executiveSummary(stats);
    res.json({ ...stats, aiSummary: summary });
  })
);
