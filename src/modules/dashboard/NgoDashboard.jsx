import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2, LogOut, Tag, CheckCircle2, Circle,
  MapPin, ClipboardCheck, Clock, PlayCircle,
  Flag, FileText,
} from 'lucide-react';
import {
  acceptReport,
  getReports,
  getNgoAvailability,
  setNgoAvailability,
  updateReportStatus,
  verifyReport,
  performAuthorityAction,
} from '../../api';
import useUrlFilters from '../../shared/useUrlFilters';
import { Badge, Button, EmptyState, FormField, Skeleton } from '../../shared/ui';
import { PaginationControls, ReportFilters } from '../../shared/ReportFilters';
import ReportPhotos from '../../shared/ReportPhotos';
import { useI18n } from '../../i18n/I18nProvider';

const DEFAULT_FILTERS = { page: '1', pageSize: '20', q: '', status: '', from: '', to: '' };

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const { t } = useI18n();
  const labels = {
    pending: 'Submitted',
    accepted: 'Accepted',
    in_progress: 'In Progress',
    resolved: 'Resolved',
  };
  return (
    <Badge tone={status === 'resolved' ? 'score-green' : status === 'in_progress' ? 'score-yellow' : 'status'}>
      {t(labels[status] || status)}
    </Badge>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function IssueMeta({ issue }) {
  const { t } = useI18n();
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#0284c7', fontWeight: 500 }}>
          <Tag size={12} /> {t(issue.category)}
        </span>
        <span className="report-item-location">
          <MapPin size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
          <span>{issue.location}</span>
        </span>
      </div>
      <div className="report-card-badges">
        <Badge tone="neutral">{t('{count} confirmations', { count: issue.confirmationCount || 0 })}</Badge>
        {issue.groupReportCount > 1 && <Badge tone="status">{t('Issue with {count} reports', { count: issue.groupReportCount })}</Badge>}
      </div>
      {issue.aiCategory && (
        <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.78rem', color: '#64748b' }}>
          AI analysis: {issue.aiCategory} · {issue.aiSeverity} severity · {issue.aiSentiment} sentiment
        </span>
      )}
    </>
  );
}

// ─── Progress control panel (shown inside My Accepted Issues) ────────────────

function ProgressPanel({ issue, ngoId, onUpdated }) {
  const { t, formatDate } = useI18n();
  const [note, setNote]           = useState('');
  const [busy, setBusy]           = useState(false);
  const [noteError, setNoteError] = useState('');
  const [actionError, setActionError] = useState('');
  const [afterPhoto, setAfterPhoto] = useState(null);
  const [afterPhotoError, setAfterPhotoError] = useState('');

  const isResolved   = issue.status === 'resolved';
  const isInProgress = issue.status === 'in_progress';
  const isAccepted   = issue.status === 'accepted';

  const nextStatus = isAccepted ? 'in_progress' : isInProgress ? 'resolved' : null;
  const btnLabel   = isAccepted ? t('Start Progress') : isInProgress ? t('Mark as Resolved') : null;
  const BtnIcon    = isAccepted ? PlayCircle : Flag;

  const handleUpdate = async () => {
    if (note.length > 300) {
      setNoteError(t('Note must be 300 characters or fewer.'));
      return;
    }
    setNoteError('');
    setActionError('');
    if (isInProgress && !afterPhoto) {
      setAfterPhotoError(t('Choose an after photo before resolving this report.'));
      return;
    }
    setAfterPhotoError('');
    setBusy(true);
    try {
      await updateReportStatus({
        reportId: issue.id,
        status: nextStatus,
        note,
        afterImage: nextStatus === 'resolved' ? afterPhoto : undefined,
      });
      setNote('');
      setAfterPhoto(null);
      await onUpdated();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
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
          {t('Accepted by')}: {issue.acceptedByOrgName}
        </div>
        {issue.acceptedAt && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#64748b' }}>
            <Clock size={13} />
            {formatDate(new Date(issue.acceptedAt), { dateStyle: 'medium', timeStyle: 'short' })}
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
      {actionError && (
        <span role="alert" style={{ fontSize: '0.78rem', color: '#ef4444' }}>{actionError}</span>
      )}
      {issue.statusUpdatedAt && !isAccepted && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#94a3b8' }}>
          <Clock size={12} />
          {t('Status updated')}: {formatDate(new Date(issue.statusUpdatedAt), { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      )}

      {/* Progress action — hide once resolved */}
      {!isResolved && nextStatus && (
        <>
          {/* Optional note textarea */}
          <textarea
            placeholder={t('Optional update note (e.g. "Work has started on clearing the waste.")')}
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
          {isInProgress && (
            <FormField
              label={t('After photo (required to resolve)')}
              htmlFor={`after-photo-${issue.id}`}
              error={afterPhotoError}
            >
              <input
                id={`after-photo-${issue.id}`}
                className="form-control input-no-prefix"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                    setAfterPhoto(null);
                    setAfterPhotoError(t('Choose a JPG, PNG, or WebP image.'));
                    event.target.value = '';
                    return;
                  }
                  if (file && file.size > 5 * 1024 * 1024) {
                    setAfterPhoto(null);
                    setAfterPhotoError(t('The after photo must be 5 MB or smaller.'));
                    event.target.value = '';
                    return;
                  }
                  setAfterPhoto(file);
                  setAfterPhotoError('');
                }}
              />
            </FormField>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="button"
              id={`btn-progress-${issue.id}`}
              variant={isAccepted ? 'primary' : 'secondary'}
              size="sm"
              disabled={busy || (isInProgress && !afterPhoto)}
              onClick={handleUpdate}
              style={isInProgress ? { background: '#16a34a', color: '#fff', borderColor: '#16a34a' } : {}}
            >
              {busy ? (
                <><span className="spinner-border" /><span>{t('Updating…')}</span></>
              ) : (
                <><BtnIcon size={14} /><span>{btnLabel}</span></>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Resolved confirmation */}
      {isResolved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: '#16a34a', fontWeight: 600 }}>
          <CheckCircle2 size={14} />
          {t('Issue resolved. Great work!')}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NgoDashboard({ currentUser, onLogout }) {
  const { t } = useI18n();
  const orgName = currentUser?.organizationName || 'Your Organization';
  const ngoType = currentUser?.ngoType || '';
  const ngoId   = currentUser?.id;

  const [availability, setAvailability] = useState(currentUser?.availability || 'available');
  const [availableIssues, setAvailableIssues] = useState([]);
  const [acceptedIssues,  setAcceptedIssues]  = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [issuesError, setIssuesError] = useState('');
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [filters, setFilters] = useUrlFilters(DEFAULT_FILTERS);
  const [availablePagination, setAvailablePagination] = useState(null);
  const [acceptedPagination, setAcceptedPagination] = useState(null);
  const [flagReasons, setFlagReasons] = useState({});
  const issuesRequestId = useRef(0);

  const isAvailable = availability === 'available';

  const loadIssues = useCallback(async () => {
    const requestId = ++issuesRequestId.current;
    setIssuesError('');
    setIssuesLoading(true);
    if (!ngoType) {
      setAcceptedIssues([]);
      setAvailableIssues([]);
      setAcceptedPagination(null);
      setAvailablePagination(null);
      if (requestId === issuesRequestId.current) setIssuesLoading(false);
      return;
    }
    try {
      const common = { ...filters, category: ngoType, pageSize: '20' };
      const [mineResult, openResult] = await Promise.all([
        getReports({ ...common, scope: 'mine' }),
        isAvailable ? getReports({ ...common, scope: 'available' }) : Promise.resolve({ reports: [], pagination: null }),
      ]);
      if (requestId !== issuesRequestId.current) return;
      setAcceptedIssues(mineResult.reports);
      setAvailableIssues(openResult.reports);
      setAcceptedPagination(mineResult.pagination);
      setAvailablePagination(openResult.pagination);
    } catch (error) {
      if (requestId === issuesRequestId.current) setIssuesError(error.message);
    } finally {
      if (requestId === issuesRequestId.current) setIssuesLoading(false);
    }
  }, [ngoType, ngoId, isAvailable, filters]);

  useEffect(() => { loadIssues(); }, [loadIssues]);

  useEffect(() => {
    let active = true;
    getNgoAvailability()
      .then((status) => {
        if (active) setAvailability(status);
      })
      .catch((error) => {
        if (active) setIssuesError(error.message);
      });
    return () => { active = false; };
  }, []);

  const handleToggle = async (newStatus) => {
    setAvailabilityBusy(true);
    setIssuesError('');
    try {
      const savedStatus = await setNgoAvailability(newStatus);
      setAvailability(savedStatus);
    } catch (error) {
      setIssuesError(error.message);
    } finally {
      setAvailabilityBusy(false);
    }
  };

  const handleAccept = async (reportId) => {
    setAccepting(reportId);
    setIssuesError('');
    try {
      await acceptReport(reportId);
      await loadIssues();
    } catch (error) {
      setIssuesError(error.message);
    } finally {
      setAccepting(null);
    }
  };

  const handleVerify = async (reportId) => {
    setVerifying(reportId);
    setIssuesError('');
    try {
      await verifyReport(reportId);
      await loadIssues();
    } catch (error) {
      setIssuesError(error.message);
    } finally {
      setVerifying(null);
    }
  };

  const handleFlagReport = async (reportId) => {
    setIssuesError('');
    try {
      await performAuthorityAction({ reportId, action: 'flag', reason: flagReasons[reportId] || '' });
      setFlagReasons((current) => ({ ...current, [reportId]: '' }));
      await loadIssues();
    } catch (error) {
      setIssuesError(error.message);
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-container">

      {/* ── Welcome ── */}
      <div className="card dashboard-welcome-card">
        <div className="user-avatar-badge"><Building2 size={24} /></div>
        <div>
          <div className="user-role-tag">{t('NGO Partner')}</div>
          <h2 className="dashboard-title">{t('Welcome, {name}!', { name: orgName })}</h2>
          <p className="dashboard-subtitle">
            {t('Signed in as')} <strong>{currentUser?.email}</strong>.
          </p>
        </div>
      </div>

      {/* ── Availability ── */}
      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('Availability')}</h3>
          <p className="card-subtitle">{t('Set whether your organisation is currently accepting issues')}</p>
        </div>

        {issuesError && (
          <div className="alert alert-error" role="alert">
            <span>{issuesError}</span>
          </div>
        )}
        {currentUser?.status === 'pending' && (
          <div className="alert alert-warning" role="status">
            {t('Your NGO application is pending admin approval. You can sign in, but cannot accept or verify reports until approved.')}
          </div>
        )}

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
            {t(isAvailable ? 'Available to accept issues' : 'Currently unavailable')}
          </span>
        </div>

        <div className="account-type-grid">
          <button type="button" id="btn-ngo-available"
            className={`account-type-btn${isAvailable ? ' active' : ''}`}
            disabled={availabilityBusy}
            onClick={() => handleToggle('available')}>
            <CheckCircle2 size={18} /><span>{t('Available')}</span>
          </button>
          <button type="button" id="btn-ngo-unavailable"
            className={`account-type-btn${!isAvailable ? ' active' : ''}`}
            disabled={availabilityBusy}
            onClick={() => handleToggle('unavailable')}>
            <Circle size={18} /><span>{t('Unavailable')}</span>
          </button>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('Search and filter reports')}</h3>
          <p className="card-subtitle">{t('Filters are saved in the page URL.')}</p>
        </div>
        <ReportFilters filters={filters} onChange={setFilters} categories={ngoType ? [ngoType] : []} />
      </div>

      {/* ── Available Issues ── */}
      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.5rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('Available Issues')}</h3>
          <p className="card-subtitle">
            {ngoType ? t('Matching issues for NGO type: {type}', { type: t(ngoType) }) : t('No NGO type set.')}
          </p>
        </div>

        {!isAvailable ? (
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>
            {t('Set your availability to')} <strong>{t('Available')}</strong> {t('to see matching issues.')}
          </p>
        ) : issuesLoading ? (
          <Skeleton lines={4} />
        ) : availableIssues.length === 0 ? (
          <EmptyState title={t('No matching open issues')} description={t('No open issues for {category} match these filters.', { category: t(ngoType || 'your NGO category') })} />
        ) : (
          <>
          <div className="reports-list">
            {availableIssues.map((issue) => (
              <div key={issue.id} className="report-item"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span className="report-item-title" style={{ flex: 1 }}>{issue.title}</span>
                  <StatusBadge status={issue.status} />
                </div>
                <IssueMeta issue={issue} />
                {issue.verified ? (
                  <span className="status-badge status-badge-resolved">{t('Verified')}</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentUser?.status !== 'active' || verifying === issue.id}
                    onClick={() => handleVerify(issue.id)}
                  >
                    {verifying === issue.id ? t('Verifying…') : t('Verify Issue')}
                  </button>
                )}
                <div className="fake-flag-controls">
                  <input className="form-control input-no-prefix" maxLength={500}
                    aria-label={t('Reason to flag report {id}', { id: issue.id })}
                    placeholder={t('Reason to flag as fake')}
                    value={flagReasons[issue.id] || ''}
                    onChange={(event) => setFlagReasons((current) => ({ ...current, [issue.id]: event.target.value }))} />
                  <button type="button" className="btn btn-secondary btn-sm"
                    disabled={currentUser?.status !== 'active' || issue.fakeFlagged === 1 || (flagReasons[issue.id] || '').trim().length < 5}
                    onClick={() => handleFlagReport(issue.id)}>{t('Flag as fake')}</button>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                  {issue.description}
                </p>
                <ReportPhotos report={issue} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    id={`btn-accept-${issue.id}`}
                    className="btn btn-primary btn-sm"
                    disabled={currentUser?.status !== 'active' || accepting === issue.id}
                    onClick={() => handleAccept(issue.id)}
                  >
                    {accepting === issue.id
                      ? <><span className="spinner-border" /><span>{t('Accepting…')}</span></>
                      : <><ClipboardCheck size={14} /><span>{t('Accept Issue')}</span></>}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <PaginationControls pagination={availablePagination} onPageChange={(page) => setFilters({ page: String(page) })} />
          </>
        )}
      </div>

      {/* ── My Accepted Issues ── */}
      <div className="card mt-3">
          <div className="card-header" style={{ marginBottom: '0.5rem' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('My Accepted Issues')}</h3>
            <p className="card-subtitle">{t('Issues your organisation has taken responsibility for')}</p>
          </div>

          {issuesLoading ? <Skeleton lines={3} /> : acceptedIssues.length ? <div className="reports-list">
            {acceptedIssues.map((issue) => (
              <div key={issue.id} className="report-item"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span className="report-item-title" style={{ flex: 1 }}>{issue.title}</span>
                  <StatusBadge status={issue.status} />
                </div>
                <IssueMeta issue={issue} />
                {issue.fakeFlagged === 1 && <Badge tone="score-red">{t('Flagged as fake')}</Badge>}
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                  {issue.description}
                </p>
                <ReportPhotos report={issue} />

                {/* Progress panel */}
                <ProgressPanel issue={issue} ngoId={ngoId} onUpdated={loadIssues} />
              </div>
            ))}
          </div> : <EmptyState title={t('No accepted issues match')} description={t('Your assigned issue list will reflect the current filters.')} />}
          <PaginationControls pagination={acceptedPagination} onPageChange={(page) => setFilters({ page: String(page) })} />
      </div>

      {/* ── Organisation Details + Sign Out ── */}
      <div className="card mt-3">
        <div className="card-header" style={{ marginBottom: '0.25rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{t('Organisation Details')}</h3>
          <p className="card-subtitle">{t('Your registered NGO information')}</p>
        </div>
        <div className="placeholder-module-box">
          <div className="placeholder-icon"><Tag size={22} /></div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 0.2rem', fontSize: '0.95rem', color: '#0f172a' }}>{t('NGO Type')}</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#0284c7', fontWeight: 600 }}>
              {ngoType || '—'}
            </p>
          </div>
        </div>
        <div className="dashboard-actions mt-3"
          style={{ paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
            <LogOut size={15} /><span>{t('Sign Out')}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
