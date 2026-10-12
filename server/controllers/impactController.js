const PDFDocument = require('pdfkit');
const { z } = require('zod');
const impactRepository = require('../db/impact');

const monthSchema = z.string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must use YYYY-MM format.')
  .refine((month) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, monthNumber - 1, 1));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === monthNumber - 1;
  }, 'Month must be a valid calendar month.');

const impactQuerySchema = z.object({
  month: monthSchema,
  category: z.string().trim().max(100).optional().default(''),
  area: z.string().trim().max(120).optional().default(''),
  ngoId: z.coerce.number().int().positive().optional(),
});

const getQuery = (req) => {
  const parsed = impactQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((issue) => issue.message).join(' '),
    };
  }
  if (req.user.role === 'ngo' && parsed.data.ngoId && parsed.data.ngoId !== req.user.id) {
    return { error: 'NGO users can only view their own impact report.', status: 403 };
  }
  if (req.user.role === 'ngo' && parsed.data.category && parsed.data.category !== req.user.ngoType) {
    return { error: 'NGO users can only view reports in their registered category.', status: 403 };
  }
  if (req.user.role === 'ngo') parsed.data.ngoId = req.user.id;
  return { data: parsed.data };
};

const getReport = (req, query) => impactRepository.getImpactReport({
  user: {
    id: req.user.id,
    role: req.user.role,
    ngo_type: req.user.ngoType || '',
    organization_name: req.user.organizationName || '',
    full_name: req.user.fullName || '',
  },
  ...query,
});

exports.getImpact = (req, res, next) => {
  const parsed = getQuery(req);
  if (parsed.error) return res.status(parsed.status || 400).json({ success: false, message: parsed.error });
  try {
    return res.json({ success: true, impact: getReport(req, parsed.data) });
  } catch (error) {
    if (error.code === 'IMPACT_CATEGORY_FORBIDDEN') {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.code === 'IMPACT_NGO_NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return next(error);
  }
};

exports.downloadImpactPdf = (req, res, next) => {
  const parsed = getQuery(req);
  if (parsed.error) return res.status(parsed.status || 400).json({ success: false, message: parsed.error });
  try {
    const impact = getReport(req, parsed.data);
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="urbanpulse-impact-${impact.month}.pdf"`,
    );
    doc.pipe(res);
    doc.fontSize(20).fillColor('#075985').text('UrbanPulse Monthly Impact Report');
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#0f172a').text(`NGO: ${impact.ngoName}`);
    doc.text(`Date range: ${impact.dateRange.start} to ${impact.dateRange.end}`);
    if (impact.category) doc.text(`Category: ${impact.category}`);
    if (impact.area) doc.text(`Area: ${impact.area}`);
    doc.moveDown();
    doc.fontSize(14).text('Summary');
    doc.moveDown(0.4);
    const rows = [
      ['Reports found', impact.summary.found],
      ['Accepted', impact.summary.accepted],
      ['Verified', impact.summary.verified],
      ['Resolved', impact.summary.resolved],
      ['Still pending', impact.summary.pending],
      ['Average time to resolve', impact.summary.averageResolutionHours === null
        ? 'No resolved reports'
        : `${impact.summary.averageResolutionHours} hours`],
    ];
    const tableX = 52;
    const tableWidth = 490;
    const rowHeight = 23;
    let tableY = doc.y;
    doc.rect(tableX, tableY, tableWidth, rowHeight).fill('#e0f2fe');
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
      .text('Measure', tableX + 8, tableY + 7, { width: 300 })
      .text('Value', tableX + 320, tableY + 7, { width: 155, align: 'right' });
    tableY += rowHeight;
    rows.forEach(([label, value], index) => {
      doc.rect(tableX, tableY, tableWidth, rowHeight).fill(index % 2 ? '#ffffff' : '#f8fafc');
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica')
        .text(label, tableX + 8, tableY + 7, { width: 300 })
        .text(String(value), tableX + 320, tableY + 7, { width: 155, align: 'right' });
      tableY += rowHeight;
    });
    doc.y = tableY + 14;
    doc.moveDown();
    doc.fontSize(14).fillColor('#0f172a').text('Top problem places');
    doc.moveDown(0.3);
    if (!impact.topPlaces.length) {
      doc.fontSize(10).text('No reports found for the selected period.');
    } else {
      impact.topPlaces.forEach((place, index) => {
        doc.fontSize(10).text(`${index + 1}. ${place.location} — ${place.reportCount} report${place.reportCount === 1 ? '' : 's'}`);
      });
    }
    doc.end();
    return undefined;
  } catch (error) {
    if (error.code === 'IMPACT_CATEGORY_FORBIDDEN') {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.code === 'IMPACT_NGO_NOT_FOUND') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return next(error);
  }
};
