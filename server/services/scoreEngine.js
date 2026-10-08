const OPEN_STATUSES = new Set(['pending', 'accepted', 'in_progress']);
const SCORE_LABELS = {
  accessibility: 'Accessibility',
  walkability: 'Walkability',
  safety: 'Safety',
  cleanliness: 'Cleanliness',
  heatComfort: 'Heat Comfort',
};
const ISSUE_LABELS = {
  accessibility: 'Accessibility needs improvement',
  walkability: 'Walkability needs improvement',
  safety: 'Safety needs improvement',
  cleanliness: 'Cleanliness needs improvement',
  heatComfort: 'Heat comfort needs improvement',
};

const average = (values) => {
  const available = values.filter((value) => value !== null && value !== undefined);
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
};

const ratingScore = (ratings, fields) => {
  const fieldAverages = fields.map((field) => average(ratings
    .map((rating) => rating[field])
    .filter((value) => value !== null && value !== undefined)))
    .filter((value) => value !== null);
  const mean = average(fieldAverages);
  return mean === null ? null : mean * 20;
};

const ratingCount = (ratings, fields) => ratings.filter((rating) =>
  fields.some((field) => rating[field] !== null && rating[field] !== undefined)).length;

// Reduce the base by applicable open-report penalties without allowing scores below zero.
const subtractPenalty = (score, penalty) =>
  score === null ? null : Math.max(0, Math.min(100, score - penalty));

const colorBand = (score) => {
  if (score === null) return null;
  if (score < 50) return 'red';
  if (score < 75) return 'yellow';
  return 'green';
};

const scoreLocation = ({ location, ratings = [], reports = [] }) => {
  const openReports = reports.filter((report) => OPEN_STATUSES.has(report.status));
  const countCategory = (categories) => openReports.filter((report) => categories.includes(report.category)).length;

  // Convert mean 1–5 ratings to percent of the maximum, averaging dimensions equally.
  const accessibility = subtractPenalty(
    ratingScore(ratings, ['accessibility']),
    countCategory(['Accessibility']) * 10,
  );
  const walkability = subtractPenalty(
    ratingScore(ratings, ['safety', 'lighting', 'seating']),
    countCategory(['Roads', 'Road & Infrastructure']) * 10,
  );
  const safetyPenalty = openReports
    .filter((report) => report.category === 'Public Safety')
    // Verified open safety reports add 5 points to the standard 10-point penalty.
    .reduce((penalty, report) => penalty + (report.verified ? 15 : 10), 0);
  const safety = subtractPenalty(ratingScore(ratings, ['safety', 'lighting']), safetyPenalty);
  const cleanliness = subtractPenalty(
    ratingScore(ratings, ['cleanliness']),
    countCategory(['Waste Management', 'Sanitation & Cleanliness']) * 10,
  );
  const heatComfort = ratingScore(ratings, ['shade', 'water_availability']);
  const scoreEntries = { accessibility, walkability, safety, cleanliness, heatComfort };
  const scoreCounts = {
    accessibility: ratingCount(ratings, ['accessibility']),
    walkability: ratingCount(ratings, ['safety', 'lighting', 'seating']),
    safety: ratingCount(ratings, ['safety', 'lighting']),
    cleanliness: ratingCount(ratings, ['cleanliness']),
    heatComfort: ratingCount(ratings, ['shade', 'water_availability']),
    overall: ratings.length,
  };
  const overall = average(Object.values(scoreEntries));
  const confidence = Object.fromEntries(
    [...Object.entries(scoreEntries), ['overall', overall]]
      .map(([key, value]) => [key, value === null ? null : (scoreCounts[key] < 3 ? 'low' : 'normal')]),
  );
  const scoredDimensions = Object.entries(scoreEntries)
    .filter(([, value]) => value !== null)
    .sort((left, right) => left[1] - right[1]);
  const weakest = scoredDimensions[0];

  let mainIssue = 'No ratings yet';
  if (weakest) {
    const [key] = weakest;
    const relevantCategories = {
      accessibility: ['Accessibility'],
      walkability: ['Roads', 'Road & Infrastructure'],
      safety: ['Public Safety'],
      cleanliness: ['Waste Management', 'Sanitation & Cleanliness'],
      heatComfort: [],
    }[key];
    const relatedOpenCount = countCategory(relevantCategories);
    mainIssue = relatedOpenCount
      ? `${relatedOpenCount} open ${relevantCategories.join(' / ')} report${relatedOpenCount === 1 ? '' : 's'}`
      : ISSUE_LABELS[key];
  }

  return {
    ...location,
    scores: { ...scoreEntries, overall },
    scoreCounts,
    confidence,
    colorBand: colorBand(overall),
    weakestScore: weakest ? {
      key: weakest[0],
      label: SCORE_LABELS[weakest[0]],
      value: Math.round(weakest[1]),
    } : null,
    mainIssue,
    openReportCount: openReports.length,
    ratingCount: ratings.length,
  };
};

module.exports = { average, colorBand, scoreLocation };
