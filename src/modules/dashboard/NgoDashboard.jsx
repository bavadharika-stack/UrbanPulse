import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, LogOut, Tag, CheckCircle2, Circle,
  MapPin, Image, ClipboardCheck, Clock, PlayCircle,
  Flag, FileText,
} from 'lucide-react';
import {
  setNgoAvailability,
  getReports,
  acceptReport,
  updateReportStatus,
} from '../../shared/authStorage';

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  Submitted:       { bg: '#f0f9ff', border: '#bae6fd', color: '#0284c7' },
  'Under Review':  { bg: '#fffbeb', border: '#fcd34d', color: '#d97706' },
  Accepted:        { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
  'In Progress':   { bg: '#fefce8', border: '#fde047', color: '#a16207' },
  Resolved:        { bg: '#f0fdf4', border: '#86efac', color: '#16a34a' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES['Submitted'];
  return (
    <span style={{
      fontSize: '0.75rem', fontWeight: 600,
      padding: '0.2rem 0.6rem', borderRadius: '999px',
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function IssueImage({ issue }) {
  if (issue.imageDataUrl) {
    return (
      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', maxHeight: '180px' }}>
        <img
          src={issue.imageDataUrl}
          alt={`Evidence for ${issue.title}`}
          style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }
  if (issue.fileName) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        fontSize: '0.8rem', color: '#94a3b8',
        padding: '0.4rem 0.6rem', background: '#f8fafc',
        borderRadius: '6px', border: '1px solid #e2e8f0',
      }}>
        <Image size={13} />
        <span>{issue.fileName}</span>
      </div>
    );
  }
  return null;
}

function IssueMeta({ issue }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#0284c7', fontWeight: 500 }}>
        <Tag size={12} /> {issue.category}
      </span>
      <span className="report-item-location">
        <MapPin size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
        <span>{issue.location}</span>
      </span>
    </div>
  );
}

// ─── Progress control panel (shown inside My Accepted Issues) ────────────────

function ProgressPanel({ issue, ngoId, onUpdated }) {
  const [note, setNote]           = useState('');
  const [busy, setBusy]           = useState(false);
  const [noteError, setNoteError] = useState('');

  const isResolved   = issue.status === 'Resolved';
  const isInProgress = issue.status === 'In Progress';
  const isAccepted   = issue.status === 'Accepted';

  const nextStatus = isAccepted ? 'In Progress' : isInProgress ? 'Resolved' : null;
  const btnLabel   = isAccepted ? 'Start Progress' : isInProgress ? 'Mark as Resolved' : null;
  const BtnIcon    = isAccepted ? PlayCircle : Flag;

  const handleUpdate = () => {
    if (note.length > 300) {
      setNoteError('Note must be 300 characters or fewer.');
      return;
    }
    setNoteError('');
    setBusy(true);
    const result = updateReportStatus({ reportId: issue.id, ngoId, status: nextStatus, note });
    setBusy(false);
    if (result) {
      setNote('');
      onUpdated();
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      padding: '0.75rem', borderRadius: '8px',
      background: '#f8fafc', border: '1px solid #e2e8f0',
    }}>

      {/* Acceptance info row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 600 }}>
          <CheckCircle2 size={13} />
          Accepted by: {issue.acceptedByOrgName}
        </div>
        {issue.acceptedAt && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#64748b' }}>
            <Clock size={13} />
            {new Date(issue.acceptedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
      </div>

      {/* Last progress note */}
      {issue.progressNote && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
          fontSize: '0.8125rem', color: '#475569',
          padding: '0.45rem 0.6rem', borderRadius: '6px',
          background: '#fff', border: '1px solid #e2e8f0',
        }}>
          <FileText size={13} style={{ flexShrink: 0, marginTop: '2px', color: '#94a3b8' }} />
          <span>{issue.progressNote}</span>
        </div>
      )}

      {/* Status-updated-at */}
      {issue.statusUpdatedAt && !isAccepted && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#94a3b8' }}>
          <Clock size={12} />
          Status updated: {new Date(issue.statusUpdatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      )}

      {/* Progress action — hide once resolved */}
      {!isResolved && nextStatus && (
        <>
          {/* Optional note textarea */}
          <textarea
            placeholder={`Optional update note (e.g. "Work has started on clearing the waste.")`}
            value={note}
            onChange={(e) => { setNote(e.target.value); setNoteError(''); }}
            rows={2}
            maxLength={300}
            style={{
              width: '100%', resize: 'vertical', fontSize: '0.8125rem',
              padding: '0.45rem 0.6rem', borderRadius: '6px',
              border: noteError ? '1px solid #ef4444' : '1px solid #cbd5e1',
              outline: 'none', fontFamily: 'inherit', color: '#334155',
              background: '#fff', boxSizing: 'border-box',
            }}
          />
          {noteError && (
            <span style={{ fontSize: '0.78rem', color: '#ef4444' }}>{noteError}</span>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              id={`btn-progress-${issue.id}`}
              className={`btn btn-sm ${isAccepted ? 'btn-primary' : 'btn-secondary'}`}
              disabled={busy}
              onClick={handleUpdate}
              style={isInProgress ? { background: '#16a34a', color: '#fff', borderColor: '#16a34a' } : {}}
            >
              {busy ? (
                <><span className="spinner-border" /><span>Updating…</span></>
              ) : (
                <><BtnIcon size={14} /><span>{btnLabel}</span></>
              )}
            </button>
          </div>
        </>
      )}

      {/* Resolved confirmation */}
      {isResolved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: '#16a34a', fontWeight: 600 }}>
          <CheckCircle2 size={14} />
          Issue resolved. Great work!
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NgoDashboard({ currentUser, onLogout }) {
  const orgName = currentUser?.organizationName || 'Your Organization';
  const ngoType = currentUser?.ngoType || '';
  const ngoId   = currentUser?.id;

  const [availability, setAvailability] = useState(currentUser?.availability || 'available');
  const [availableIssues, setAvailableIssues] = useState([]);
  const [acceptedIssues,  setAcceptedIssues]  = useState([]);
  const [accepting, setAccepting] = useState(null);

  const isAvailable = availability === 'available';

  const loadIssues = useCallback(() => {
    const all     = getReports();
    const matched = all.filter((r) => r.category && r.category === ngoType);

    // Issues owned by this NGO (any status past Accepted)
    const mine = matched.filter(
      (r) => ['Accepted', 'In Progress', 'Resolved'].includes(r.status) && r.acceptedByNgoId === ngoId
    );

    // Open issues — unaccepted and NGO is available
    const open = isAvailable
      ? matched.filter((r) => !['Accepted', 'In Progress', 'Resolved'].includes(r.status))
      : [];

    setAcceptedIssues(mine);
    setAvailableIssues(open);
  }, [ngoType, ngoId, isAvailable]);

  useEffect(() => { loadIssues(); }, [loadIssues]);

  const handleToggle = (newStatus) => {
    setAvailability(newStatus);
    setNgoAvailability(ngoId, newStatus);
  };

  const handleAccept = (reportId) => {
    setAccepting(reportId);
    const result = acceptReport({ reportId, ngoId, orgName });
    if (!result) {
      alert('This issue has already been accepted by another NGO.');
    }
    loadIssues();
    setAccepting(null);
  };

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-container">

      {/* ── Welcome ── */}
      <div className="card dashboard-welcome-card">
        <div className="user-avatar-badge"><Building2 size={24} /></div>
        <div>
          <div className="user-role-tag">NGO Partner</div>
          <h2 className="dashboard-title">Welcome, {orgName}!</h2>
          <p className="dashboard-subtitle">
            Signed in as <strong>{currentUser?.email}</strong>.
          </p>
        </div>
      </div>

      {/* ── Availability ── */}
      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Availability</h3>
          <p className="card-subtitle">Set whether your organisation is currently accepting issues</p>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '1rem', padding: '0.6rem 0.85rem', borderRadius: '8px',
          background: isAvailable ? '#f0fdf4' : '#f8fafc',
          border: `1px solid ${isAvailable ? '#86efac' : '#e2e8f0'}`,
        }}>
          {isAvailable
            ? <CheckCircle2 size={18} color="#16a34a" />
            : <Circle       size={18} color="#94a3b8" />}
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: isAvailable ? '#16a34a' : '#64748b' }}>
            {isAvailable ? 'Available to accept issues' : 'Currently unavailable'}
          </span>
        </div>

        <div className="account-type-grid">
          <button type="button" id="btn-ngo-available"
            className={`account-type-btn${isAvailable ? ' active' : ''}`}
            onClick={() => handleToggle('available')}>
            <CheckCircle2 size={18} /><span>Available</span>
          </button>
          <button type="button" id="btn-ngo-unavailable"
            className={`account-type-btn${!isAvailable ? ' active' : ''}`}
            onClick={() => handleToggle('unavailable')}>
            <Circle size={18} /><span>Unavailable</span>
          </button>
        </div>
      </div>

      {/* ── Available Issues ── */}
      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.5rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Available Issues</h3>
          <p className="card-subtitle">
            {ngoType ? `Matching issues for NGO type: ${ngoType}` : 'No NGO type set.'}
          </p>
        </div>

        {!isAvailable ? (
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>
            Set your availability to <strong>Available</strong> to see matching issues.
          </p>
        ) : availableIssues.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>
            No open issues matching <strong>{ngoType}</strong> at this time.
          </p>
        ) : (
          <div className="reports-list">
            {availableIssues.map((issue) => (
              <div key={issue.id} className="report-item"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span className="report-item-title" style={{ flex: 1 }}>{issue.title}</span>
                  <StatusBadge status={issue.status} />
                </div>
                <IssueMeta issue={issue} />
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                  {issue.description}
                </p>
                <IssueImage issue={issue} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    id={`btn-accept-${issue.id}`}
                    className="btn btn-primary btn-sm"
                    disabled={accepting === issue.id}
                    onClick={() => handleAccept(issue.id)}
                  >
                    {accepting === issue.id
                      ? <><span className="spinner-border" /><span>Accepting…</span></>
                      : <><ClipboardCheck size={14} /><span>Accept Issue</span></>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── My Accepted Issues ── */}
      {acceptedIssues.length > 0 && (
        <div className="card mt-3">
          <div className="card-header" style={{ marginBottom: '0.5rem' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem' }}>My Accepted Issues</h3>
            <p className="card-subtitle">Issues your organisation has taken responsibility for</p>
          </div>

          <div className="reports-list">
            {acceptedIssues.map((issue) => (
              <div key={issue.id} className="report-item"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span className="report-item-title" style={{ flex: 1 }}>{issue.title}</span>
                  <StatusBadge status={issue.status} />
                </div>
                <IssueMeta issue={issue} />
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                  {issue.description}
                </p>
                <IssueImage issue={issue} />

                {/* Progress panel */}
                <ProgressPanel issue={issue} ngoId={ngoId} onUpdated={loadIssues} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Organisation Details + Sign Out ── */}
      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Organisation Details</h3>
          <p className="card-subtitle">Your registered NGO information</p>
        </div>
        <div className="placeholder-module-box">
          <div className="placeholder-icon"><Tag size={22} /></div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 0.2rem', fontSize: '0.95rem', color: '#0f172a' }}>NGO Type</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#0284c7', fontWeight: 600 }}>
              {ngoType || '—'}
            </p>
          </div>
        </div>
        <div className="dashboard-actions mt-3"
          style={{ paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
            <LogOut size={15} /><span>Sign Out</span>
          </button>
        </div>
      </div>

    </div>
  );
}
