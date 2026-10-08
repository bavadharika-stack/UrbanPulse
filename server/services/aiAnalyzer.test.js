const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeWithRules } = require('./aiAnalyzer');

const samples = [
  {
    title: 'Wheelchair access blocked',
    description: 'The blocked ramp is unusable for wheelchair users.',
    category: 'Accessibility',
    severity: 'high',
    sentiment: 'negative',
  },
  {
    title: 'Open manhole',
    description: 'There is an open manhole beside the sidewalk.',
    category: 'Safety',
    severity: 'high',
    sentiment: 'neutral',
  },
  {
    title: 'Overflowing waste bin',
    description: 'Dirty trash and garbage are overflowing near the bus stop.',
    category: 'Sanitation',
    severity: 'medium',
    sentiment: 'negative',
  },
  {
    title: 'Large pothole',
    description: 'A damaged pothole is on the road.',
    category: 'Roads',
    severity: 'medium',
    sentiment: 'negative',
  },
  {
    title: 'Streetlight out',
    description: 'The streetlight is not working.',
    category: 'Lighting',
    severity: 'medium',
    sentiment: 'negative',
  },
  {
    title: 'Electricity outage',
    description: 'A power outage has left the building without electricity.',
    category: 'Electricity',
    severity: 'low',
    sentiment: 'neutral',
  },
  {
    title: 'Broken park bench',
    description: 'The bench in the park is broken.',
    category: 'Parks',
    severity: 'medium',
    sentiment: 'negative',
  },
  {
    title: 'Urgent exposed wire',
    description: 'Emergency: an exposed wire is dangerous. Please act immediately.',
    category: 'Safety',
    severity: 'high',
    sentiment: 'urgent',
  },
  {
    title: 'Clean public restroom',
    description: 'Thank you for keeping the public space clean.',
    category: 'Sanitation',
    severity: 'low',
    sentiment: 'positive',
  },
  {
    title: 'Curb cut',
    description: 'The wheelchair curb cut is excellent.',
    category: 'Accessibility',
    severity: 'low',
    sentiment: 'positive',
  },
  {
    title: 'Collapsed road',
    description: 'A life-threatening collapse has made the road impassable.',
    category: 'Roads',
    severity: 'critical',
    sentiment: 'urgent',
  },
];

for (const [index, sample] of samples.entries()) {
  test(`rules classifier sample ${index + 1}: ${sample.title}`, () => {
    const result = analyzeWithRules(sample);
    assert.deepEqual(result, {
      category: sample.category,
      severity: sample.severity,
      sentiment: sample.sentiment,
      department: {
        Accessibility: 'Public Infrastructure Department',
        Safety: 'Public Safety Department',
        Electricity: 'Electrical Department',
        Sanitation: 'Sanitation Department',
        Roads: 'Roads Department',
        Lighting: 'Electrical Department',
        Parks: 'Parks Department',
      }[sample.category],
      provider: 'rules',
    });
  });
}
