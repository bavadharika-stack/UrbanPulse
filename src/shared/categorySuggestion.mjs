const CATEGORY_RULES = [
  ['Accessibility', ['wheelchair', 'ramp', 'curb cut', 'mobility', 'handrail', 'tactile', 'accessible']],
  ['Public Safety', ['unsafe', 'danger', 'accident', 'injury', 'crime', 'harassment', 'hazard', 'open manhole']],
  ['Electricity', ['electricity', 'power outage', 'power cut', 'transformer', 'exposed wire']],
  ['Sanitation & Cleanliness', ['trash', 'garbage', 'waste', 'litter', 'rubbish', 'sewage', 'drain', 'dirty']],
  ['Road & Infrastructure', ['road', 'pothole', 'pavement', 'sidewalk', 'pathway', 'footpath', 'crosswalk']],
  ['Lighting', ['streetlight', 'street light', 'street lamp', 'darkness', 'dark', 'lamp post', 'bulb']],
  ['Parks', ['park', 'playground', 'green space', 'garden', 'bench', 'tree', 'grass']],
];

export const suggestCategory = (text) => {
  const normalized = text.toLowerCase();
  return CATEGORY_RULES.find(([, keywords]) => keywords.some((keyword) => (
    keyword.includes(' ') ? normalized.includes(keyword) : new RegExp(`\\b${keyword}\\b`, 'i').test(normalized)
  )))?.[0] || '';
};
