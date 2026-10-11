const IGNORED_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'it', 'near',
  'details', 'issue', 'issues', 'of', 'on', 'problem', 'problems', 'report', 'reports',
  'test', 'the', 'there', 'to', 'with',
]);

const tokenizeReport = ({ title = '', description = '' }) =>
  new Set(
    `${title} ${description}`
      .toLowerCase()
      .match(/[a-z0-9]+/g)?.filter((word) => word.length > 1 && !IGNORED_WORDS.has(word)) || [],
  );

const calculateTextSimilarity = (firstReport, secondReport) => {
  const firstWords = tokenizeReport(firstReport);
  const secondWords = tokenizeReport(secondReport);
  if (!firstWords.size || !secondWords.size) return 0;
  const sharedWords = [...firstWords].filter((word) => secondWords.has(word)).length;
  return sharedWords / Math.min(firstWords.size, secondWords.size);
};

const isLikelyDuplicate = (firstReport, secondReport) => {
  const firstWords = tokenizeReport(firstReport);
  const secondWords = tokenizeReport(secondReport);
  const sharedWords = [...firstWords].filter((word) => secondWords.has(word)).length;
  return sharedWords >= 2 && calculateTextSimilarity(firstReport, secondReport) >= 0.5;
};

module.exports = { calculateTextSimilarity, isLikelyDuplicate };
