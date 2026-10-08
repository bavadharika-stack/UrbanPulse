import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, LogOut, RefreshCw } from 'lucide-react';
import { getReports } from '../../api';
import reportCategories from '../../../shared/reportCategories.json';

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
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = async () => {
    setIsLoading(true);
    setError('');
    try {
      setReports(await getReports());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReports(); }, []);

  const departments = useMemo(
    () => [...new Set(reports.map((report) => report.department).filter(Boolean))].sort(),
    [reports],
  );

  const statusCounts = useMemo(() => reports.reduce((counts, report) => {
    counts[report.status] = (counts[report.status] || 0) + 1;
    return counts;
  }, { pending: 0, accepted: 0, in_progress: 0, resolved: 0 }), [reports]);

  const categoryCounts = useMemo(() => reports.reduce((counts, report) => {
    counts[report.category] = (counts[report.category] || 0) + 1;
    return counts;
  }, {}), [reports]);

  const categories = useMemo(
    () => [...new Set([...reportCategories, ...Object.keys(categoryCounts)])].sort(),
    [categoryCounts],
  );

  const filteredReports = reports.filter((report) => (
    (!departmentFilter || report.department === departmentFilter)
    && (!categoryFilter || report.category === categoryFilter)
    && (!priorityFilter || report.priority === priorityFilter)
  ));

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
              onClick={() => setCategoryFilter(categoryFilter === category ? '' : category)}
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
              <div className="stat-number">{statusCounts[status] || 0}</div>
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.85rem' }}>
          <div className="form-group" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <label className="form-label" htmlFor="authority-category-filter">Category</label>
            <select
              id="authority-category-filter"
              className="form-control input-no-prefix"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <label className="form-label" htmlFor="authority-department-filter">Department</label>
            <select
              id="authority-department-filter"
              className="form-control input-no-prefix"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((department) => <option key={department}>{department}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
            <label className="form-label" htmlFor="authority-priority-filter">Priority</label>
            <select
              id="authority-priority-filter"
              className="form-control input-no-prefix"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option value="">All priorities</option>
              {['low', 'medium', 'high', 'critical'].map((priority) => (
                <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadReports}
            disabled={isLoading}
            style={{ alignSelf: 'flex-end' }}
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
            <p className="card-subtitle" style={{ textAlign: 'center', padding: '1rem' }}>Loading reports…</p>
          ) : filteredReports.length === 0 ? (
            <p className="card-subtitle" style={{ textAlign: 'center', padding: '1rem' }}>
              No reports match the selected filters.
            </p>
          ) : filteredReports.map((report) => (
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
                {report.verified && (
                  <span className="status-badge status-badge-resolved" style={{ alignSelf: 'flex-start' }}>
                    NGO Verified
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <span
                  className="status-badge"
                  style={{
                    color: PRIORITY_COLORS[report.priority] || PRIORITY_COLORS.medium,
                    border: `1px solid ${PRIORITY_COLORS[report.priority] || PRIORITY_COLORS.medium}`,
                  }}
                >
                  {(report.priority || 'medium').toUpperCase()}
                </span>
                <span className="status-badge status-badge-submitted">
                  {STATUS_LABELS[report.status] || report.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
