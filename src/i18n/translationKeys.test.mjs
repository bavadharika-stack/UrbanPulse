import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import en from './en.json' with { type: 'json' };
import ta from './ta.json' with { type: 'json' };
import reportCategories from '../../shared/reportCategories.json' with { type: 'json' };

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(jsx?|tsx?)$/.test(entry.name) ? [entryPath] : [];
  }));
  return nested.flat();
}

test('every English UI string has a Tamil translation entry', () => {
  assert.deepEqual(Object.keys(ta).sort(), Object.keys(en).sort());
  for (const [key, value] of Object.entries(ta)) {
    assert.equal(typeof value, 'string', `${key} must have a Tamil string`);
    assert.ok(value.trim().length > 0, `${key} must not have an empty translation`);
  }
});

test('dynamic report categories, ratings, statuses and priorities are translated', () => {
  const dynamicLabels = [
    ...reportCategories,
    'Accessibility', 'Walkability', 'Safety', 'Cleanliness', 'Heat comfort',
    'Seating', 'Shade', 'Water availability',
    'pending', 'accepted', 'in progress', 'resolved',
    'low', 'medium', 'high', 'critical',
  ];
  for (const key of dynamicLabels) {
    assert.ok(key in en, `Missing English entry for ${key}`);
    assert.ok(key in ta, `Missing Tamil entry for ${key}`);
  }
});

test('literal translation keys used in UI source exist in both dictionaries', async () => {
  const files = await sourceFiles(sourceRoot);
  const missing = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*(['"])(.*?)\1/g)) {
      const key = match[2];
      if (!(key in en) || !(key in ta)) {
        missing.push(`${path.relative(sourceRoot, file)}: ${key}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
