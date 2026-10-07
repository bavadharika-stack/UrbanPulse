const DEPARTMENTS = new Map([
  ['Waste Management', 'Sanitation Department'],
  ['Sanitation & Cleanliness', 'Sanitation Department'],
  ['Public Safety', 'Electrical Department'],
  ['Roads', 'Roads Department'],
  ['Road & Infrastructure', 'Roads Department'],
  ['Accessibility', 'Public Infrastructure Department'],
  ['Parks', 'Parks Department'],
  ['Environment & Green Spaces', 'Parks Department'],
]);

const CATEGORY_SEVERITY = new Map([
  ['Waste Management', { label: 'medium', score: 2 }],
  ['Sanitation & Cleanliness', { label: 'medium', score: 2 }],
  ['Public Safety', { label: 'high', score: 4 }],
  ['Roads', { label: 'high', score: 4 }],
  ['Road & Infrastructure', { label: 'high', score: 4 }],
  ['Accessibility', { label: 'high', score: 4 }],
  ['Parks', { label: 'low', score: 1 }],
  ['Environment & Green Spaces', { label: 'low', score: 1 }],
]);

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const getDepartment = (category) => DEPARTMENTS.get(category) || 'Public Works Department';

const getCategorySeverity = (category) => CATEGORY_SEVERITY.get(category) || { label: 'medium', score: 2 };

const raisePriority = (priority) => PRIORITIES[Math.min(PRIORITIES.indexOf(priority) + 1, PRIORITIES.length - 1)];

const calculatePriority = ({ category, sameLocationCount, description, verified = false }) => {
  const severity = getCategorySeverity(category);
  const mentionsHazardLocation = /\b(school|hospital|night|dark)\b/i.test(description);
  const score = severity.score
    + Math.min(sameLocationCount, 3)
    + (mentionsHazardLocation ? 2 : 0);
  const threshold = score >= 7 ? 3 : score >= 4 ? 2 : score >= 2 ? 1 : 0;
  const priority = PRIORITIES[threshold];
  return { severity: severity.label, priority: verified ? raisePriority(priority) : priority };
};

module.exports = {
  calculatePriority,
  getDepartment,
  raisePriority,
};
