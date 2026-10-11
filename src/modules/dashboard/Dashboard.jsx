import React, { useState, useEffect } from 'react';
import { User, LogOut, Camera, ArrowRight, MapPin, CheckCircle2, Clock, FileText, AlertCircle, Map, Star } from 'lucide-react';
import { getReports } from '../../api';
import reportCategories from '../../../shared/reportCategories.json';
import useUrlFilters from '../../shared/useUrlFilters';
import { EmptyState, Skeleton } from '../../shared/ui';
import { PaginationControls, ReportFilters } from '../../shared/ReportFilters';

const DEFAULT_FILTERS = { page: '1', pageSize: '20', q: '', category: '', status: '', from: '', to: '' };

export default function Dashboard({ currentUser, onLogout, onStartReport, onOpenMap, onRatePlace }) {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState({ total: 0, underReview: 0, resolved: 0 });
  const [reportsError, setReportsError] = useState('');
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [filters, setFilters] = useUrlFilters(DEFAULT_FILTERS);

  useEffect(() => {
    let active = true;
    setIsLoadingReports(true);
    getReports(filters)
      .then((result) => {
        if (!active) return;
        setReports(result.reports);
        setPagination(result.pagination);
        setStats({
          total: result.summary.total,
          underReview: result.summary.accepted + result.summary.in_progress,
          resolved: result.summary.resolved,
        });
      })
      .catch((error) => {
        if (active) setReportsError(error.message);
      })
      .finally(() => {
        if (active) setIsLoadingReports(false);
      });
    return () => { active = false; };
  }, [filters]);

  // Helper to render status badge with appropriate styling
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="status-badge status-badge-resolved">
            <CheckCircle2 size={11} style={{ marginRight: '3px' }} />
            Resolved
          </span>
        );
      case 'accepted':
        return (
          <span className="status-badge status-badge-review">
            <Clock size={11} style={{ marginRight: '3px' }} />
            Under Review
          </span>
        );
      case 'in_progress':
        return (
          <span className="status-badge status-badge-review">
            <Clock size={11} style={{ marginRight: '3px' }} />
            In Progress
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="status-badge status-badge-submitted">
            <FileText size={11} style={{ marginRight: '3px' }} />
            Submitted
          </span>
        );
    }
  };

  return (
    <div className="dashboard-container">
      {/* 1. Welcome Card */}
      <div className="card dashboard-welcome-card">
        <div className="user-avatar-badge">
          <User size={24} />
        </div>
        <div>
          <div className="user-role-tag">Citizen Contributor</div>
          <h2 className="dashboard-title">Welcome back, {currentUser?.fullName || 'Citizen'}!</h2>
          <p className="dashboard-subtitle">
            You are signed in as <strong>{currentUser?.email}</strong>.
          </p>
        </div>
      </div>

      {/* 2. My Activity Section */}
      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>My Activity</h3>
          <p className="card-subtitle">Overview of your public space contributions</p>
        </div>

        {reportsError && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={18} className="alert-icon" />
            <span>{reportsError}</span>
          </div>
        )}
        <div className="activity-stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Reports Submitted</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#d97706' }}>{stats.underReview}</div>
            <div className="stat-label">Under Review</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: '#059669' }}>{stats.resolved}</div>
            <div className="stat-label">Resolved</div>
          </div>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Explore and Rate Public Spaces</h3>
          <p className="card-subtitle">See community scores across Chennai or add your experience.</p>
        </div>
        <div className="dashboard-actions mt-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenMap}>
            <Map size={15} /><span>Open Place Map</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRatePlace}>
            <Star size={15} /><span>Rate a Place</span>
          </button>
        </div>
      </div>

      {/* 3. Primary Action Card: Report an Issue */}
      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span>Citizen Portal Active</span>
          </div>
          <h3 className="card-title mt-1" style={{ fontSize: '1.1rem' }}>Public Space Intelligence</h3>
          <p className="card-subtitle">
            Report public space concerns such as damaged pathways, broken lighting, or waste management issues.
          </p>
        </div>

        <div className="placeholder-module-box">
          <div className="placeholder-icon">
            <Camera size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 0.2rem', fontSize: '0.95rem', color: '#0f172a' }}>
              Report a Public Space Issue
            </h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
              Provide location, issue details, and photographic evidence for municipal action.
            </p>
          </div>
          <button
            type="button"
            id="btn-start-report"
            className="btn btn-primary btn-sm"
            onClick={onStartReport}
            style={{ whiteSpace: 'nowrap' }}
          >
            <span>Report an Issue</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 4. My Reports / Recent Reports Section */}
      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>My Reports & Recent Activity</h3>
          <p className="card-subtitle">Track the status of your reported public space issues</p>
        </div>

        <ReportFilters filters={filters} onChange={setFilters} categories={reportCategories} />
        <div className="reports-list">
          {isLoadingReports ? (
            <Skeleton lines={4} />
          ) : reports.length === 0 ? (
            <EmptyState title="No matching reports" description="Adjust the search and filters, or submit a new issue." />
          ) : (
            reports.map((rep) => (
              <div key={rep.id} className="report-item">
                <div className="report-item-main">
                  <span className="report-item-title">{rep.title}</span>
                  <span className="report-item-location">
                    <MapPin size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
                    <span>{rep.location}</span>
                  </span>
                  {rep.publicResponse && (
                    <div className="public-response">
                      <strong>Authority response</strong>
                      <p>{rep.publicResponse}</p>
                    </div>
                  )}
                  {rep.fakeFlagged === 1 && <span className="status-badge status-badge-review">Under trust review</span>}
                </div>
                <div>
                  {renderStatusBadge(rep.status)}
                </div>
              </div>
            ))
          )}
        </div>
        <PaginationControls pagination={pagination} onPageChange={(page) => setFilters({ page: String(page) })} />

        {/* Sign Out Action */}
        <div className="dashboard-actions mt-3" style={{ paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onLogout}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
