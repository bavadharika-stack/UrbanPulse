import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Building2, LogOut, RefreshCw } from 'lucide-react';
import {
  getLocationScores,
  getPlacesForModeration,
  getReports,
  getReportHistory,
  updatePlaceStatus,
  performAuthorityAction,
} from '../../api';
import reportCategories from '../../../shared/reportCategories.json';
import useUrlFilters from '../../shared/useUrlFilters';
import { Badge, EmptyState, FormField, Skeleton } from '../../shared/ui';
import { PaginationControls, ReportFilters } from '../../shared/ReportFilters';
import ReportPhotos from '../../shared/ReportPhotos';
import { useI18n } from '../../i18n/I18nProvider';

const DEFAULT_FILTERS = {
  page: '1', pageSize: '20', q: '', category: '', status: '', from: '', to: '', department: '', priority: '',
};

const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const PRIORITY_COLORS = {
  low: '#64748b',
  medium: '#0284c7',
  high: '#d97706',
  critical: '#dc2626',
};
const ScoreTrend = React.lazy(() => import('../../shared/ScoreTrend'));

export default function AuthorityDashboard({ currentUser, onLogout }) {
  const { t, formatNumber, formatDate } = useI18n();
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState({ total: 0, pending: 0, accepted: 0, in_progress: 0, resolved: 0 });
  const [categoryCounts, setCategoryCounts] = useState({});
  const [departments, setDepartments] = useState([]);
  const [locationScores, setLocationScores] = useState([]);
  const [trendLocationId, setTrendLocationId] = useState('');
  const [citizenPlaces, setCitizenPlaces] = useState([]);
  const [placeActionBusy, setPlaceActionBusy] = useState(null);
  const [filters, setFilters] = useUrlFilters(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [scoreError, setScoreError] = useState('');
  const [placeModerationError, setPlaceModerationError] = useState('');
  const [actionDrafts, setActionDrafts] = useState({});
  const [actionBusy, setActionBusy] = useState(null);
  const [reportHistory, setReportHistory] = useState({});
  const departmentOptions = [...new Set([
    'Sanitation Department',
    'Public Safety Department',
    'Electrical Department',
    'Roads Department',
    'Public Infrastructure Department',
    'Parks Department',
    'Public Works Department',
  ])];
  const reportsRequestId = useRef(0);

  const loadReports = async (query = filters) => {
    const requestId = ++reportsRequestId.current;
    setIsLoading(true);
    setError('');
    try {
      const result = await getReports(query);
      if (requestId !== reportsRequestId.current) return;
      setReports(result.reports);
      setPagination(result.pagination);
      setSummary(result.summary);
      setCategoryCounts(result.categoryCounts);
      setDepartments(result.departments);
    } catch (loadError) {
      if (requestId === reportsRequestId.current) setError(loadError.message);
    } finally {
      if (requestId === reportsRequestId.current) setIsLoading(false);
    }
  };

  const loadLocationScores = async () => {
    setScoreError('');
    try {
      const scores = await getLocationScores();
      setLocationScores(scores);
      setTrendLocationId((current) => current || String(scores[0]?.id || ''));
    } catch (loadError) {
      setScoreError(loadError.message);
    }
  };

  const loadCitizenPlaces = async () => {
    setPlaceModerationError('');
    try {
      setCitizenPlaces(await getPlacesForModeration());
    } catch (loadError) {
      setPlaceModerationError(loadError.message);
    }
  };

  useEffect(() => {
    loadReports(filters);
  }, [filters]);

  useEffect(() => {
    loadLocationScores();
    loadCitizenPlaces();
  }, []);

  const handlePlaceStatus = async (place, status) => {
    setPlaceActionBusy(place.id);
    setPlaceModerationError('');
    try {
      await updatePlaceStatus({ locationId: place.id, status });
      await Promise.all([loadCitizenPlaces(), loadLocationScores()]);
    } catch (actionError) {
      setPlaceModerationError(actionError.message);
    } finally {
      setPlaceActionBusy(null);
    }
  };

  const updateDraft = (reportId, key, value) => {
    setActionDrafts((current) => ({
      ...current,
      [reportId]: { ...current[reportId], [key]: value },
    }));
  };

  const runReportAction = async (report, action, body = {}) => {
    setActionBusy(`${report.id}-${action}`);
    setError('');
    try {
      const updated = await performAuthorityAction({ reportId: report.id, action, ...body });
      setReports((items) => items.map((item) => item.id === report.id ? updated : item));
      updateDraft(report.id, action === 'priority' ? 'priorityReason' : action === 'respond' ? 'response' : 'reason', '');
      await loadReports(filters);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActionBusy(null);
    }
  };

  const toggleReportHistory = async (reportId) => {
    if (reportHistory[reportId]) {
      setReportHistory((current) => ({ ...current, [reportId]: null }));
      return;
    }
    setActionBusy(`${reportId}-history`);
    setError('');
    try {
      const events = await getReportHistory(reportId);
      setReportHistory((current) => ({ ...current, [reportId]: events }));
    } catch (historyError) {
      setError(historyError.message);
    } finally {
      setActionBusy(null);
    }
  };

  const categories = useMemo(
    () => [...new Set([...reportCategories, ...Object.keys(categoryCounts)])].sort(),
    [categoryCounts],
  );

  const categoryFilter = filters.category;

  return (
    <div className="dashboard-container" style={{ maxWidth: '100%' }}>
      <div className="card dashboard-welcome-card">
        <div className="user-avatar-badge"><Building2 size={24} /></div>
        <div style={{ flex: 1 }}>
          <div className="user-role-tag">{t('Authority')}</div>
          <h2 className="dashboard-title">{t('Public Space Reports')}</h2>
          <p className="dashboard-subtitle">
            {t('Signed in as')} <strong>{currentUser?.email}</strong>. {t('Review and prioritize incoming reports.')}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
          <LogOut size={15} /><span>{t('Sign Out')}</span>
        </button>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('Public-Space Scores by Location')}</h3>
          <p className="card-subtitle">{t('Lowest available score and the main improvement area for each place')}</p>
        </div>
        {scoreError && (
          <div className="alert alert-error mt-2" role="alert">
            <AlertCircle size={18} className="alert-icon" /><span>{scoreError}</span>
          </div>
        )}
        <div className="score-table-wrap mt-2" role="region" aria-label={t('Public-space scores by location')} tabIndex="0">
          <table className="score-table">
            <thead>
              <tr>
                <th scope="col">{t('Location')}</th>
                <th scope="col">{t('Overall')}</th>
                <th scope="col">{t('Weakest score')}</th>
                <th scope="col">{t('Main issue')}</th>
                <th scope="col">{t('Open issues')}</th>
              </tr>
            </thead>
            <tbody>
              {locationScores.map((place) => (
                <tr key={place.id}>
                  <th scope="row">{place.name}</th>
                  <td>
                    {place.scores.overall === null ? t('No data') : (
                      <>
                        {Math.round(place.scores.overall)}/100, {t('based on {count} ratings', { count: formatNumber(place.scoreCounts.overall) })}
                        {place.confidence.overall === 'low' && <Badge tone="score-yellow" className="rating-confidence">{t('Low confidence')}</Badge>}
                      </>
                    )}
                  </td>
                  <td>
                    {place.weakestScore
                      ? <>
                        {t(place.weakestScore.label)}: {place.weakestScore.value}/100, {t('based on {count} ratings', { count: formatNumber(place.scoreCounts[place.weakestScore.key]) })}
                        {place.confidence[place.weakestScore.key] === 'low' && <Badge tone="score-yellow" className="rating-confidence">{t('Low confidence')}</Badge>}
                      </>
                      : t('No data')}
                  </td>
                  <td>{place.mainIssue}</td>
                  <td>{place.openReportCount}</td>
                </tr>
              ))}
              {!locationScores.length && !scoreError && (
                <tr><td colSpan="5">{t('No location scores are available.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.5rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('Place score trends')}</h3>
          <p className="card-subtitle">{t('Compare all six scores across the selected period.')}</p>
        </div>
        <FormField label={t('Location')} htmlFor="authority-trend-location">
          <select id="authority-trend-location" className="form-control input-no-prefix"
            value={trendLocationId}
            onChange={(event) => setTrendLocationId(event.target.value)}>
            {locationScores.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select>
        </FormField>
        {trendLocationId
          ? <Suspense fallback={<Skeleton lines={3} />}>
            <ScoreTrend key={trendLocationId} locationId={trendLocationId}
              locationName={locationScores.find((place) => String(place.id) === String(trendLocationId))?.name || 'Location'} />
          </Suspense>
          : <EmptyState title={t('No locations available')} description={t('Score history will appear when a mapped location is available.')} />}
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('Citizen-added places')}</h3>
          <p className="card-subtitle">{t('Hide spam locations from citizens and the public map, or restore them.')}</p>
        </div>
        {placeModerationError && (
          <div className="alert alert-error mt-2" role="alert">
            <AlertCircle size={18} className="alert-icon" /><span>{placeModerationError}</span>
          </div>
        )}
        <div className="reports-list">
          {citizenPlaces.length === 0 && !placeModerationError ? (
            <p className="card-subtitle" style={{ textAlign: 'center', padding: '1rem' }}>
              {t('No citizen-added places yet.')}
            </p>
          ) : citizenPlaces.map((place) => (
            <article key={place.id} className="report-item citizen-place-row">
              <div className="report-item-main" style={{ flex: 1, minWidth: 0 }}>
                <span className="report-item-title">{place.name}</span>
                <span className="report-item-location">
                  {place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}
                </span>
                <span className={`status-badge ${place.status === 'active' ? 'status-badge-resolved' : 'status-badge-submitted'}`}>
                  {t(place.status === 'active' ? 'Visible' : 'Hidden')}
                </span>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${place.status === 'active' ? 'btn-secondary' : 'btn-primary'}`}
                disabled={placeActionBusy === place.id}
                onClick={() => handlePlaceStatus(place, place.status === 'active' ? 'hidden' : 'active')}
              >
                {placeActionBusy === place.id
                  ? t('Updating…')
                  : t(place.status === 'active' ? 'Hide' : 'Restore')}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('Reports by Category')}</h3>
          <p className="card-subtitle">{t('Select a category to view its citizen reports')}</p>
        </div>
        <div className="activity-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))' }}>
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              className="stat-card"
              aria-pressed={categoryFilter === category}
              onClick={() => setFilters({ category: categoryFilter === category ? '' : category, page: '1' })}
              style={{
                cursor: 'pointer',
                border: categoryFilter === category ? '2px solid #0284c7' : undefined,
                font: 'inherit',
                textAlign: 'center',
              }}
            >
              <div className="stat-number">{categoryCounts[category] || 0}</div>
              <div className="stat-label">{t(category)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('Report Status Counts')}</h3>
          <p className="card-subtitle">{t('All reports currently in the system')}</p>
        </div>
        <div className="activity-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))' }}>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div className="stat-card" key={status}>
              <div className="stat-number">{summary[status] || 0}</div>
              <div className="stat-label">{t(label)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('All Reports')}</h3>
          <p className="card-subtitle">{t('Filter by category, assigned department, or calculated priority')}</p>
        </div>

        <ReportFilters
          filters={filters}
          onChange={setFilters}
          categories={categories}
          departments={departments}
          showDepartment
          showPriority
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadReports(filters)}
            disabled={isLoading}
          >
            <RefreshCw size={15} /><span>{t('Refresh')}</span>
          </button>
        </div>

        {error && (
          <div className="alert alert-error mt-3" role="alert">
            <AlertCircle size={18} className="alert-icon" /><span>{error}</span>
          </div>
        )}

        <div className="reports-list">
          {isLoading ? (
            <Skeleton lines={4} />
          ) : reports.length === 0 ? (
            <EmptyState title={t('No matching reports')} description={t('Try changing your search or filters.')} />
          ) : reports.map((report) => (
            <article key={report.id} className="report-item" style={{ alignItems: 'flex-start' }}>
              <div className="report-item-main" style={{ flex: 1, minWidth: 0 }}>
                <span className="report-item-title">{report.title}</span>
                <span className="report-item-location">{report.location}</span>
                <span className="card-subtitle">{t(report.category)} · {report.department || t('Unassigned')}</span>
                <div className="report-card-badges">
                  <Badge tone="neutral">{t('{count} confirmations', { count: formatNumber(report.confirmationCount || 0) })}</Badge>
                  {report.groupReportCount > 1 && <Badge tone="status">{t('Issue with {count} reports', { count: formatNumber(report.groupReportCount) })}</Badge>}
                </div>
                <ReportPhotos report={report} />
                {report.aiCategory && (
                  <span className="card-subtitle">
                    {t('AI: {category} · {severity} severity · {sentiment} sentiment', {
                      category: report.aiCategory,
                      severity: t(report.aiSeverity),
                      sentiment: t(report.aiSentiment),
                    })}
                  </span>
                )}
                {report.verified && <Badge tone="score-green">{t('NGO Verified')}</Badge>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <Badge tone="priority" style={{ color: PRIORITY_COLORS[report.priority] || PRIORITY_COLORS.medium }}>
                  {(report.priority || 'medium').toUpperCase()}
                </Badge>
                <Badge tone={report.status === 'resolved' ? 'score-green' : report.status === 'in_progress' ? 'score-yellow' : 'status'}>
                  {t(STATUS_LABELS[report.status] || report.status)}
                </Badge>
              </div>
              {report.fakeFlagged === 1 && (
                <Badge tone="score-red" className="fake-report-badge">{t('Flagged as fake · priority reduced')}</Badge>
              )}
              <div className="authority-report-actions">
                <FormField label={t('Department')} htmlFor={`assign-${report.id}`}>
                  <select id={`assign-${report.id}`} className="form-control input-no-prefix"
                    value={actionDrafts[report.id]?.department ?? report.department ?? ''}
                    onChange={(event) => updateDraft(report.id, 'department', event.target.value)}>
                    <option value="">{t('Choose department')}</option>
                    {departmentOptions.map((department) => <option value={department} key={department}>{t(department)}</option>)}
                  </select>
                  <button type="button" className="btn btn-secondary btn-sm mt-1"
                    disabled={!actionDrafts[report.id]?.department || actionBusy === `${report.id}-assign`}
                    onClick={() => runReportAction(report, 'assign', { department: actionDrafts[report.id].department })}>{t('Assign')}</button>
                </FormField>
                <FormField label={t('Priority (reason required)')} htmlFor={`priority-${report.id}`}>
                  <select id={`priority-${report.id}`} className="form-control input-no-prefix"
                    value={actionDrafts[report.id]?.priority ?? report.priority ?? 'medium'}
                    onChange={(event) => updateDraft(report.id, 'priority', event.target.value)}>
                    {['low', 'medium', 'high', 'critical'].map((priority) => <option value={priority} key={priority}>{t(priority)}</option>)}
                  </select>
                  <input className="form-control input-no-prefix mt-1" aria-label={t('Reason for priority change on report {id}', { id: report.id })}
                    maxLength={500} placeholder={t('Explain the priority change')}
                    value={actionDrafts[report.id]?.priorityReason || ''}
                    onChange={(event) => updateDraft(report.id, 'priorityReason', event.target.value)} />
                  <button type="button" className="btn btn-secondary btn-sm mt-1"
                    disabled={(actionDrafts[report.id]?.priorityReason || '').trim().length < 5 || actionBusy === `${report.id}-priority`}
                    onClick={() => runReportAction(report, 'priority', {
                      priority: actionDrafts[report.id]?.priority || report.priority || 'medium',
                      reason: actionDrafts[report.id].priorityReason,
                    })}>{t('Update priority')}</button>
                </FormField>
                <FormField label={t('Public response')} htmlFor={`response-${report.id}`}>
                  <textarea id={`response-${report.id}`} className="form-control input-no-prefix" rows={2} maxLength={2000}
                    value={actionDrafts[report.id]?.response || ''} placeholder={t('Response visible to the citizen')}
                    onChange={(event) => updateDraft(report.id, 'response', event.target.value)} />
                  <button type="button" className="btn btn-secondary btn-sm mt-1"
                    disabled={(actionDrafts[report.id]?.response || '').trim().length < 3 || actionBusy === `${report.id}-respond`}
                    onClick={() => runReportAction(report, 'respond', { response: actionDrafts[report.id].response })}>{t('Send response')}</button>
                </FormField>
                <div className="authority-action-buttons">
                  <button type="button" className="btn btn-secondary btn-sm"
                    disabled={actionBusy === `${report.id}-history`}
                    onClick={() => toggleReportHistory(report.id)}>
                    {t(reportHistory[report.id] ? 'Hide history' : 'View history')}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm"
                    disabled={report.status === 'resolved' || actionBusy === `${report.id}-resolve`}
                    onClick={() => runReportAction(report, 'resolve')}>{t('Mark resolved')}</button>
                  <button type="button" className="btn btn-secondary btn-sm"
                    disabled={report.fakeFlagged === 1 || (actionDrafts[report.id]?.reason || '').trim().length < 5 || actionBusy === `${report.id}-flag`}
                    onClick={() => runReportAction(report, 'flag', { reason: actionDrafts[report.id]?.reason })}>{t('Flag as fake')}</button>
                  <input aria-label={t('Reason to flag report {id}', { id: report.id })} className="form-control input-no-prefix"
                    maxLength={500} placeholder={t('Reason to flag as fake')}
                    value={actionDrafts[report.id]?.reason || ''}
                    onChange={(event) => updateDraft(report.id, 'reason', event.target.value)} />
                </div>
                {reportHistory[report.id] && (
                  <ol className="report-history">
                    {reportHistory[report.id].map((event) => (
                      <li key={event.id}>
                        <strong>{t(event.eventType.replaceAll('_', ' '))}</strong>
                        <span>{event.details}</span>
                        <small>{event.actorName} · {formatDate(new Date(event.createdAt))}</small>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </article>
          ))}
        </div>
        <PaginationControls pagination={pagination} onPageChange={(page) => setFilters({ page: String(page) })} />
      </div>
    </div>
  );
}
