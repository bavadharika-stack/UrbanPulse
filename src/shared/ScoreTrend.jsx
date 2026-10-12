import React, { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getLocationHistory } from '../api';
import { Badge, Button, Skeleton } from './ui';
import { useI18n } from '../i18n/I18nProvider';

const SERIES = [
  ['overall', 'Overall', '#0f766e'],
  ['accessibility', 'Accessibility', '#2563eb'],
  ['walkability', 'Walkability', '#7c3aed'],
  ['safety', 'Safety', '#dc2626'],
  ['cleanliness', 'Cleanliness', '#d97706'],
  ['heatComfort', 'Heat comfort', '#0891b2'],
];

export default function ScoreTrend({ locationId, locationName = 'Location' }) {
  const { t, formatDate, formatNumber } = useI18n();
  const [days, setDays] = useState(30);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getLocationHistory(locationId, days)
      .then((result) => { if (active) setHistory(result); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locationId, days]);

  const snapshots = history?.snapshots || [];
  const summary = history?.trend || { direction: '', change: null };
  const summaryText = summary.change === null
    ? t(summary.direction)
    : t('{direction} {change} in {days} days', {
      direction: t(summary.direction),
      change: `${summary.change > 0 ? '+' : ''}${formatNumber(summary.change)}`,
      days: formatNumber(days),
    });

  return (
    <section className="score-trend" aria-label={t('{name} score trend', { name: locationName })}>
      <div className="score-trend-heading">
        <strong>{t('{name} score history', { name: locationName })}</strong>
        {summaryText && (
          <Badge tone={summary.direction === 'Improving' ? 'score-green' : summary.direction === 'Declining' ? 'score-red' : 'neutral'}>
            {summaryText}
          </Badge>
        )}
      </div>
      <div className="score-trend-controls" aria-label={t('Trend date range')}>
        {[30, 90, 365].map((range) => (
          <Button
            key={range}
            variant={days === range ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={days === range}
            onClick={() => setDays(range)}
          >
            {t('{days} days', { days: formatNumber(range) })}
          </Button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <Skeleton lines={3} /> : snapshots.length ? (
        <>
          <div className="score-trend-chart" role="img" aria-label={t('Line chart showing overall and five place scores for {name} over {days} days.', { name: locationName, days: formatNumber(days) })}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshots} margin={{ top: 12, right: 12, bottom: 2, left: -18 }}>
                <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
                <XAxis dataKey="createdAt" tickFormatter={(value) => value.slice(5, 10)} minTickGap={24} />
                <YAxis domain={[0, 100]} width={42} />
                <Tooltip
                  labelFormatter={(value) => formatDate(new Date(value))}
                  contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
                />
                <Legend />
                {SERIES.map(([key, name, color]) => (
                  <Line key={key} type="monotone" dataKey={key} name={t(name)} stroke={color}
                    strokeWidth={key === 'overall' ? 3 : 1.7} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="score-trend-text" aria-label={t('Recent score values')}>
            {SERIES.map(([key, name]) => {
              const latest = snapshots[snapshots.length - 1][key];
              return <li key={key}>{t(name)}: {latest === null ? t('No score') : `${Math.round(latest)}/100`}</li>;
            })}
          </ul>
        </>
      ) : !error && <p className="card-subtitle">{t('No score history is available for this period.')}</p>}
    </section>
  );
}
