const SCORE_KEYS = ['accessibility', 'walkability', 'safety', 'cleanliness', 'heatComfort', 'overall'];

const getTrendSummary = (snapshots, days) => {
  if (!snapshots.length) return { direction: 'No history yet', change: null, days };
  const ordered = [...snapshots].sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  const start = ordered[0].overall;
  const end = ordered[ordered.length - 1].overall;
  if (start === null || start === undefined || end === null || end === undefined) {
    return { direction: 'Not enough score data', change: null, days };
  }
  const change = Math.round(end - start);
  return {
    direction: change > 0 ? 'Improving' : change < 0 ? 'Declining' : 'Stable',
    change,
    days,
  };
};

module.exports = { SCORE_KEYS, getTrendSummary };
