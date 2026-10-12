const averageResolutionHours = (reports) => {
  const durations = reports
    .filter((report) => report.status === 'resolved' && report.createdAt && report.resolvedAt)
    .map((report) => (new Date(report.resolvedAt) - new Date(report.createdAt)) / 3600000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0);
  return durations.length
    ? Math.round((durations.reduce((sum, hours) => sum + hours, 0) / durations.length) * 10) / 10
    : null;
};

const summarizeImpact = (reports) => ({
  found: reports.length,
  accepted: reports.filter((report) => Boolean(report.acceptedByNgoId)).length,
  verified: reports.filter((report) => Boolean(report.verified)).length,
  resolved: reports.filter((report) => report.status === 'resolved').length,
  pending: reports.filter((report) => report.status === 'pending').length,
  averageResolutionHours: averageResolutionHours(reports),
});

module.exports = { averageResolutionHours, summarizeImpact };
