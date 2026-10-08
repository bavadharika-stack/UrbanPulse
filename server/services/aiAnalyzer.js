const { z } = require('zod');
const CATEGORY_DEPARTMENTS = {
  Accessibility: 'Public Infrastructure Department',
  Safety: 'Public Safety Department',
  Electricity: 'Electrical Department',
  Sanitation: 'Sanitation Department',
  Roads: 'Roads Department',
  Lighting: 'Electrical Department',
  Parks: 'Parks Department',
};

const CATEGORY_KEYWORDS = {
  Accessibility: [
    'accessible', 'accessibility', 'wheelchair', 'ramp', 'curb cut',
    'mobility', 'handrail', 'tactile', 'disabled',
  ],
  Safety: [
    'unsafe', 'danger', 'dangerous', 'accident', 'injury', 'crime',
    'harassment', 'exposed wire', 'open manhole', 'hazard',
  ],
  Electricity: [
    'electricity', 'electrical', 'power outage', 'power cut', 'transformer',
    'electrician',
  ],
  Sanitation: [
    'trash', 'garbage', 'waste', 'litter', 'rubbish', 'bin', 'dump',
    'dirty', 'filthy', 'sewage', 'drain', 'overflow', 'cleanliness', 'clean',
  ],
  Roads: [
    'road', 'pothole', 'pavement', 'sidewalk', 'pathway', 'footpath',
    'crack', 'damaged surface', 'crosswalk', 'traffic signal',
  ],
  Lighting: [
    'light', 'lighting', 'streetlight', 'street light', 'street lamp',
    'lamp post', 'dark', 'darkness', 'bulb', 'illuminat',
  ],
  Parks: [
    'park', 'playground', 'green space', 'garden', 'bench', 'tree',
    'grass', 'recreation', 'public space',
  ],
};

const SEVERITY_KEYWORDS = {
  critical: ['life-threatening', 'collapsed', 'collapse', 'electrocution', 'trapped'],
  high: ['urgent', 'emergency', 'severe', 'serious', 'injured', 'injury', 'fire', 'exposed wire', 'blocked ramp', 'open manhole'],
  medium: ['broken', 'damaged', 'overflow', 'overflowing', 'blocked', 'unsafe', 'not working', 'cracked'],
};

const SENTIMENT_KEYWORDS = {
  urgent: ['urgent', 'emergency', 'immediately', 'right away', 'life-threatening', 'dangerous'],
  negative: ['bad', 'dirty', 'broken', 'damaged', 'unsafe', 'disappointed', 'poor', 'unusable', 'blocked', 'not working'],
  positive: ['thank', 'thanks', 'excellent', 'great', 'clean', 'fixed', 'improved', 'wonderful'],
};

const resultSchema = z.object({
  category: z.enum(['Accessibility', 'Safety', 'Electricity', 'Sanitation', 'Roads', 'Lighting', 'Parks']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']),
});

const includesKeyword = (text, keyword) => {
  if (keyword.includes(' ')) return text.includes(keyword);
  return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
};

const matchesAny = (text, keywords) => keywords.some((keyword) => includesKeyword(text, keyword));

const analyzeWithRules = ({ title = '', description = '' }) => {
  const text = `${title} ${description}`.toLowerCase();
  const category = Object.keys(CATEGORY_KEYWORDS).find((name) =>
    matchesAny(text, CATEGORY_KEYWORDS[name])
  ) || 'Parks';

  let severity = 'low';
  if (matchesAny(text, SEVERITY_KEYWORDS.critical)) severity = 'critical';
  else if (matchesAny(text, SEVERITY_KEYWORDS.high)) severity = 'high';
  else if (matchesAny(text, SEVERITY_KEYWORDS.medium)) severity = 'medium';

  const sentiment = matchesAny(text, SENTIMENT_KEYWORDS.urgent)
    ? 'urgent'
    : matchesAny(text, SENTIMENT_KEYWORDS.negative)
      ? 'negative'
      : matchesAny(text, SENTIMENT_KEYWORDS.positive)
        ? 'positive'
        : 'neutral';

  return {
    category,
    severity,
    sentiment,
    department: CATEGORY_DEPARTMENTS[category],
    provider: 'rules',
  };
};

const analyzeWithGemini = async ({ title, description }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const endpoint = new URL(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
    );
    endpoint.searchParams.set('key', config.geminiApiKey);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: [
              'Classify this civic issue. Return only JSON with category (Accessibility, Safety, Electricity, Sanitation, Roads, Lighting, or Parks),',
              'severity (low, medium, high, or critical), and sentiment (positive, neutral, negative, or urgent).',
              `Title: ${title}`,
              `Description: ${description}`,
            ].join('\n'),
          }],
        }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}.`);
    const payload = await response.json();
    const candidateText = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('');
    if (!candidateText) throw new Error('Gemini returned no classification.');
    const parsed = resultSchema.parse(JSON.parse(candidateText));
    return {
      ...parsed,
      department: CATEGORY_DEPARTMENTS[parsed.category],
      provider: 'gemini',
    };
  } finally {
    clearTimeout(timeout);
  }
};

const analyzeReport = async ({ title = '', description = '' }) => {
  const rulesResult = () => analyzeWithRules({ title, description });
  const config = require('../config');
  if (config.aiProvider !== 'gemini') return rulesResult();
  if (!config.geminiApiKey) {
    console.warn('AI_PROVIDER is gemini but GEMINI_API_KEY is empty; using rules classifier.');
    return rulesResult();
  }
  try {
    return await analyzeWithGemini({ title, description });
  } catch (error) {
    console.warn(`Gemini analysis failed; using rules classifier: ${error.message}`);
    return rulesResult();
  }
};

module.exports = {
  analyzeReport,
  analyzeWithRules,
};
