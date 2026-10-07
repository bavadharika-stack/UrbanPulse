import React, { useState, useEffect } from 'react';
import { User, LogOut, Camera, ArrowRight, MapPin, CheckCircle2, Clock, FileText } from 'lucide-react';
import { getReports, getActivityStats } from '../../shared/authStorage';

export default function Dashboard({ currentUser, onLogout, onStartReport }) {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ total: 0, underReview: 0, resolved: 0 });

  // Load reports and activity statistics from demo storage
  useEffect(() => {
    const loadedReports = getReports();
    const loadedStats = getActivityStats();
    setReports(loadedReports);
    setStats(loadedStats);
  }, []);

  // Helper to render status badge with appropriate styling
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="status-badge status-badge-resolved">
            <CheckCircle2 size={11} style={{ marginRight: '3px' }} />
            Resolved
          </span>
        );
      case 'Under Review':
        return (
          <span className="status-badge status-badge-review">
            <Clock size={11} style={{ marginRight: '3px' }} />
            Under Review
          </span>
        );
      case 'Submitted':
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

        <div className="reports-list">
          {reports.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>
              No reports submitted yet. Click "Report an Issue" to submit your first report.
            </p>
          ) : (
            reports.map((rep) => (
              <div key={rep.id} className="report-item">
                <div className="report-item-main">
                  <span className="report-item-title">{rep.title}</span>
                  <span className="report-item-location">
                    <MapPin size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
                    <span>{rep.location}</span>
                  </span>
                </div>
                <div>
                  {renderStatusBadge(rep.status)}
                </div>
              </div>
            ))
          )}
        </div>

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
