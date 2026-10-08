import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Building2, LogOut, RefreshCw } from 'lucide-react';
import {
  getLocationScores,
  getPlacesForModeration,
  getReports,
  updatePlaceStatus,
} from '../../api';
import reportCategories from '../../../shared/reportCategories.json';
import useUrlFilters from '../../shared/useUrlFilters';
import { Badge, EmptyState, Skeleton } from '../../shared/ui';
import { PaginationControls, ReportFilters } from '../../shared/ReportFilters';

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

export default function AuthorityDashboard({ currentUser, onLogout }) {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState({ total: 0, pending: 0, accepted: 0, in_progress: 0, resolved: 0 });
  const [categoryCounts, setCategoryCounts] = useState({});
  const [departments, setDepartments] = useState([]);
  const [locationScores, setLocationScores] = useState([]);
  const [citizenPlaces, setCitizenPlaces] = useState([]);
  const [placeActionBusy, setPlaceActionBusy] = useState(null);
  const [filters, setFilters] = useUrlFilters(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [scoreError, setScoreError] = useState('');
  const [placeModerationError, setPlaceModerationError] = useState('');
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
      setLocationScores(await getLocationScores());
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
          <div className="user-role-tag">Authority</div>
          <h2 className="dashboard-title">Public Space Reports</h2>
          <p className="dashboard-subtitle">
            Signed in as <strong>{currentUser?.email}</strong>. Review and prioritize incoming reports.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
          <LogOut size={15} /><span>Sign Out</span>
        </button>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Public-Space Scores by Location</h3>
          <p className="card-subtitle">Lowest available score and the main improvement area for each place</p>
        </div>
        {scoreError && (
          <div className="alert alert-error mt-2" role="alert">
            <AlertCircle size={18} className="alert-icon" /><span>{scoreError}</span>
          </div>
        )}
        <div className="score-table-wrap mt-2" role="region" aria-label="Public-space scores by location" tabIndex="0">
          <table className="score-table">
            <thead>
              <tr>
                <th scope="col">Location</th>
                <th scope="col">Overall</th>
                <th scope="col">Weakest score</th>
                <th scope="col">Main issue</th>
                <th scope="col">Open issues</th>
              </tr>
            </thead>
            <tbody>
              {locationScores.map((place) => (
                <tr key={place.id}>
                  <th scope="row">{place.name}</th>
                  <td>
                    {place.scores.overall === null ? 'No data' : (
                      <>
                        {Math.round(place.scores.overall)}/100, based on {place.scoreCounts.overall} ratings
                        {place.confidence.overall === 'low' && <Badge tone="score-yellow" className="rating-confidence">Low confidence</Badge>}
                      </>
                    )}
                  </td>
                  <td>
                    {place.weakestScore
                      ? <>
                        {place.weakestScore.label}: {place.weakestScore.value}/100, based on {place.scoreCounts[place.weakestScore.key]} ratings
                        {place.confidence[place.weakestScore.key] === 'low' && <Badge tone="score-yellow" className="rating-confidence">Low confidence</Badge>}
                      </>
                      : 'No data'}
                  </td>
                  <td>{place.mainIssue}</td>
                  <td>{place.openReportCount}</td>
                </tr>
              ))}
              {!locationScores.length && !scoreError && (
                <tr><td colSpan="5">No location scores are available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Citizen-added places</h3>
          <p className="card-subtitle">Hide spam locations from citizens and the public map, or restore them.</p>
        </div>
        {placeModerationError && (
          <div className="alert alert-error mt-2" role="alert">
            <AlertCircle size={18} className="alert-icon" /><span>{placeModerationError}</span>
          </div>
        )}
        <div className="reports-list">
          {citizenPlaces.length === 0 && !placeModerationError ? (
            <p className="card-subtitle" style={{ textAlign: 'center', padding: '1rem' }}>
              No citizen-added places yet.
            </p>
          ) : citizenPlaces.map((place) => (
            <article key={place.id} className="report-item citizen-place-row">
              <div className="report-item-main" style={{ flex: 1, minWidth: 0 }}>
                <span className="report-item-title">{place.name}</span>
                <span className="report-item-location">
                  {place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}
                </span>
                <span className={`status-badge ${place.status === 'active' ? 'status-badge-resolved' : 'status-badge-submitted'}`}>
                  {place.status === 'active' ? 'Visible' : 'Hidden'}
                </span>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${place.status === 'active' ? 'btn-secondary' : 'btn-primary'}`}
                disabled={placeActionBusy === place.id}
                onClick={() => handlePlaceStatus(place, place.status === 'active' ? 'hidden' : 'active')}
              >
                {placeActionBusy === place.id
                  ? 'Updating…'
                  : place.status === 'active' ? 'Hide' : 'Restore'}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Reports by Category</h3>
          <p className="card-subtitle">Select a category to view its citizen reports</p>
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
              <div className="stat-label">{category}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Report Status Counts</h3>
          <p className="card-subtitle">All reports currently in the system</p>
        </div>
        <div className="activity-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))' }}>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div className="stat-card" key={status}>
              <div className="stat-number">{summary[status] || 0}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>All Reports</h3>
          <p className="card-subtitle">Filter by category, assigned department, or calculated priority</p>
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
            <RefreshCw size={15} /><span>Refresh</span>
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
            <EmptyState title="No matching reports" description="Try changing your search or filters." />
          ) : reports.map((report) => (
            <article key={report.id} className="report-item" style={{ alignItems: 'flex-start' }}>
              <div className="report-item-main" style={{ flex: 1, minWidth: 0 }}>
                <span className="report-item-title">{report.title}</span>
                <span className="report-item-location">{report.location}</span>
                <span className="card-subtitle">{report.category} · {report.department || 'Unassigned'}</span>
                {report.aiCategory && (
                  <span className="card-subtitle">
                    AI: {report.aiCategory} · {report.aiSeverity} severity · {report.aiSentiment} sentiment
                  </span>
                )}
                {report.verified && <Badge tone="score-green">NGO Verified</Badge>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <Badge tone="priority" style={{ color: PRIORITY_COLORS[report.priority] || PRIORITY_COLORS.medium }}>
                  {(report.priority || 'medium').toUpperCase()}
                </Badge>
                <Badge tone={report.status === 'resolved' ? 'score-green' : report.status === 'in_progress' ? 'score-yellow' : 'status'}>
                  {STATUS_LABELS[report.status] || report.status}
                </Badge>
              </div>
            </article>
          ))}
        </div>
        <PaginationControls pagination={pagination} onPageChange={(page) => setFilters({ page: String(page) })} />
      </div>
    </div>
  );
}
