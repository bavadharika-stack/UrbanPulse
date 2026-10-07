import { getLegacyDemoData } from '../api';

const legacyData = getLegacyDemoData();

const DEFAULT_DEMO_REPORTS = [
  {
    id: 'rep-1',
    title: 'Damaged pathway',
    location: 'Anna Nagar, Chennai',
    category: 'Road & Infrastructure',
    description: 'The pathway near the park entrance is damaged and difficult for pedestrians to use.',
    status: 'Under Review',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    userEmail: 'demo@urbanpulse.com',
  },
  {
    id: 'rep-2',
    title: 'Overflowing waste bin',
    location: 'Mogappair, Chennai',
    category: 'Waste Management',
    description: 'Public waste bin overflowing near the bus stop causing hygiene issues.',
    status: 'Resolved',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    userEmail: 'demo@urbanpulse.com',
  },
  {
    id: 'rep-3',
    title: 'Broken streetlight',
    location: 'Ambattur, Chennai',
    category: 'Public Safety',
    description: 'Streetlight pole #14 is non-functional creating visibility issues.',
    status: 'Submitted',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    userEmail: 'demo@urbanpulse.com',
  },
];

let reports = legacyData.reports || DEFAULT_DEMO_REPORTS;
const ngoAvailability = new Map(Object.entries(legacyData.ngoAvailability));

export const getNgoAvailability = (ngoId) => ngoAvailability.get(ngoId) || null;

export const setNgoAvailability = (ngoId, status) => {
  ngoAvailability.set(ngoId, status);
};

export const getReports = () => reports;

export const saveReport = ({ title, location, category, description, fileName, imageDataUrl }) => {
  const newReport = {
    id: `rep-${Date.now()}`,
    title: title.trim(),
    location: location.trim(),
    category: category || '',
    description: description.trim(),
    fileName: fileName || '',
    imageDataUrl: imageDataUrl || '',
    status: 'Submitted',
    createdAt: new Date().toISOString(),
    userEmail: 'citizen@urbanpulse.com',
  };

  reports = [newReport, ...reports];
  return newReport;
};

export const getActivityStats = () => ({
  total: reports.length,
  underReview: reports.filter((report) => report.status === 'Under Review').length,
  resolved: reports.filter((report) => report.status === 'Resolved').length,
});

export const acceptReport = ({ reportId, ngoId, orgName }) => {
  const index = reports.findIndex((report) => report.id === reportId);
  if (index === -1) return null;

  const report = reports[index];
  if (report.status === 'Accepted' && report.acceptedByNgoId !== ngoId) return null;

  const updated = {
    ...report,
    status: 'Accepted',
    acceptedByNgoId: ngoId,
    acceptedByOrgName: orgName,
    acceptedAt: new Date().toISOString(),
  };
  reports = reports.map((item, itemIndex) => itemIndex === index ? updated : item);
  return updated;
};

export const updateReportStatus = ({ reportId, ngoId, status, note }) => {
  const allowedTransitions = {
    Accepted: 'In Progress',
    'In Progress': 'Resolved',
  };
  const index = reports.findIndex((report) => report.id === reportId);
  if (index === -1) return null;

  const report = reports[index];
  if (report.acceptedByNgoId !== ngoId || allowedTransitions[report.status] !== status) return null;

  const updated = {
    ...report,
    status,
    progressNote: note ? note.trim() : (report.progressNote || ''),
    statusUpdatedAt: new Date().toISOString(),
  };
  reports = reports.map((item, itemIndex) => itemIndex === index ? updated : item);
  return updated;
};
