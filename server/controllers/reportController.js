const fs = require('fs/promises');
const path = require('path');
const { z } = require('zod');
const reportsRepository = require('../db/reports');
const { analyzeReport } = require('../services/aiAnalyzer');
const { reportListQuerySchema } = require('../services/reportListQuery');

const projectRoot = path.resolve(__dirname, '..', '..');

const createReportSchema = z.object({
  location: z.string().trim().min(2).max(200),
  title: z.string().trim().min(2).max(160),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(5).max(5000),
});

const reportIdSchema = z.coerce.number().int().positive();
const reportStatusSchema = z.object({
  status: z.enum(['in_progress', 'resolved']),
  note: z.string().trim().max(300).optional(),
});
const validationMessage = (error) =>
  error.issues.map((issue) => issue.message).join(' ');

const removeUploadedFile = async (file) => {
  if (file) await fs.unlink(file.path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
};

exports.create = async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success || !req.file) {
    await removeUploadedFile(req.file);
    return res.status(400).json({
      success: false,
      message: parsed.success ? 'An evidence image is required.' : validationMessage(parsed.error),
    });
  }

  const imagePath = path.relative(projectRoot, req.file.path).split(path.sep).join('/');
  try {
    const aiAnalysis = await analyzeReport(parsed.data);
    const report = await reportsRepository.createReport({
      citizenId: req.user.id,
      ...parsed.data,
      imagePath,
      aiAnalysis,
    });
    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully.',
      report,
    });
  } catch (error) {
    await removeUploadedFile(req.file);
    if (error.code === 'REPORT_DAILY_LIMIT') {
      return res.status(429).json({
        success: false,
        message: 'You have reached the daily limit of 10 reports. Please try again tomorrow.',
      });
    }
    console.error('Report Creation Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not save the report. Please try again.',
    });
  }
};

exports.list = async (req, res, next) => {
  const parsedQuery = reportListQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({
      success: false,
      message: validationMessage(parsedQuery.error),
    });
  }
  try {
    const result = await reportsRepository.getReports({
      userId: req.user.id,
      role: req.user.role,
      ...parsedQuery.data,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

exports.getById = async (req, res, next) => {
  const parsedId = reportIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ success: false, message: 'Report ID must be a positive integer.' });
  }

  try {
    const report = await reportsRepository.getReportById({
      id: parsedId.data,
      userId: req.user.id,
      role: req.user.role,
    });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }
    return res.json({ success: true, report });
  } catch (error) {
    return next(error);
  }
};

exports.history = async (req, res, next) => {
  const parsedId = reportIdSchema.safeParse(req.params.id);
  if (!parsedId.success) return res.status(400).json({ success: false, message: 'Report ID must be a positive integer.' });
  try {
    const events = await reportsRepository.getReportHistory({
      id: parsedId.data,
      userId: req.user.id,
      role: req.user.role,
    });
    if (!events) return res.status(404).json({ success: false, message: 'Report not found.' });
    return res.json({ success: true, events });
  } catch (error) {
    return next(error);
  }
};

exports.accept = async (req, res, next) => {
  const parsedId = reportIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ success: false, message: 'Report ID must be a positive integer.' });
  }

  try {
    const report = await reportsRepository.acceptReport({
      id: parsedId.data,
      ngoId: req.user.id,
      organizationName: req.user.organizationName || req.user.fullName,
      ngoType: req.user.ngoType,
    });
    if (!report) {
      return res.status(409).json({
        success: false,
        message: 'This report is no longer pending or has already been accepted.',
      });
    }
    return res.json({ success: true, report });
  } catch (error) {
    return next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  const parsedId = reportIdSchema.safeParse(req.params.id);
  const parsedBody = reportStatusSchema.safeParse(req.body);
  if (!parsedId.success || !parsedBody.success) {
    return res.status(400).json({
      success: false,
      message: parsedId.success ? validationMessage(parsedBody.error) : 'Report ID must be a positive integer.',
    });
  }

  try {
    const report = await reportsRepository.updateReportStatus({
      id: parsedId.data,
      ngoId: req.user.id,
      status: parsedBody.data.status,
      note: parsedBody.data.note || '',
    });
    if (!report) {
      return res.status(409).json({
        success: false,
        message: 'Only the accepting NGO can advance a report through its allowed statuses.',
      });
    }
    return res.json({ success: true, report });
  } catch (error) {
    return next(error);
  }
};

exports.verify = async (req, res, next) => {
  const parsedId = reportIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ success: false, message: 'Report ID must be a positive integer.' });
  }

  try {
    const report = await reportsRepository.verifyReport({
      id: parsedId.data,
      ngoId: req.user.id,
      ngoType: req.user.ngoType,
    });
    if (!report) {
      return res.status(409).json({
        success: false,
        message: 'This report is already verified, does not exist, or is outside your NGO category.',
      });
    }
    return res.json({ success: true, report });
  } catch (error) {
    return next(error);
  }
};

const authorityAction = (action) => async (req, res, next) => {
  const parsedId = reportIdSchema.safeParse(req.params.id);
  const schemas = {
    assign: z.object({ department: z.string().trim().min(2).max(100) }),
    priority: z.object({
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      reason: z.string().trim().min(5).max(500),
    }),
    respond: z.object({ response: z.string().trim().min(3).max(2000) }),
    flag: z.object({ reason: z.string().trim().min(5).max(500) }),
    resolve: z.object({}).optional(),
  };
  const parsedBody = schemas[action].safeParse(req.body || {});
  if (!parsedId.success || !parsedBody.success) {
    return res.status(400).json({
      success: false,
      message: parsedId.success ? validationMessage(parsedBody.error) : 'Report ID must be a positive integer.',
    });
  }
  try {
    const report = await reportsRepository.updateAuthorityAction({
      id: parsedId.data,
      actorId: req.user.id,
      action,
      ...parsedBody.data,
    });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    return res.json({ success: true, report });
  } catch (error) {
    return next(error);
  }
};

exports.assignDepartment = authorityAction('assign');
exports.changePriority = authorityAction('priority');
exports.publicResponse = authorityAction('respond');
exports.resolveByAuthority = authorityAction('resolve');
exports.flagAsFake = authorityAction('flag');
