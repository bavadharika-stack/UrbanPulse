import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import {
  getAdminLocations,
  getAdminUsers,
  getAuditLog,
  updateAdminUserStatus,
  updateLocationStatus,
} from '../../api';
import { Badge, EmptyState, FormField, Skeleton } from '../../shared/ui';

export default function AdminDashboard({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [activeAccounts, setActiveAccounts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [audit, setAudit] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [accountStatusFilter, setAccountStatusFilter] = useState('deactivated');
  const [auditAction, setAuditAction] = useState('');
  const [auditQuery, setAuditQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedUsers, loadedAccounts, loadedLocations, loadedAudit] = await Promise.all([
        getAdminUsers({ role: 'ngo', status: statusFilter }),
        getAdminUsers({ status: accountStatusFilter }),
        getAdminLocations(),
        getAuditLog({ page: '1', pageSize: '50', action: auditAction, q: auditQuery }),
      ]);
      setUsers(loadedUsers);
      setActiveAccounts(loadedAccounts.filter((user) => user.role !== 'admin'));
      setLocations(loadedLocations);
      setAudit(loadedAudit.entries);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, accountStatusFilter, auditAction, auditQuery]);

  useEffect(() => { loadData(); }, [loadData]);

  const setAccountStatus = async (user, status) => {
    setBusy(`user-${user.id}`);
    setError('');
    try {
      await updateAdminUserStatus({ userId: user.id, status });
      await loadData();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  };

  const setPlaceStatus = async (place, status) => {
    setBusy(`place-${place.id}`);
    setError('');
    try {
      await updateLocationStatus({ locationId: place.id, status });
      setLocations((items) => items.map((item) => item.id === place.id ? { ...item, status } : item));
      await loadData();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="dashboard-container admin-dashboard">
      <section className="card dashboard-welcome-card">
        <div className="user-avatar-badge"><ShieldCheck size={24} /></div>
        <div>
          <div className="user-role-tag">Administration</div>
          <h2 className="dashboard-title">Admin controls</h2>
          <p className="dashboard-subtitle">Review NGO applications, manage user accounts and moderate public places.</p>
        </div>
      </section>

      {error && <div className="alert alert-error mt-3" role="alert"><AlertCircle size={18} />{error}</div>}

      <section className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">NGO applications and accounts</h3>
          <p className="card-subtitle">New NGO registrations require admin approval before report actions are available.</p>
        </div>
        <FormField label="NGO status" htmlFor="admin-ngo-status">
          <select id="admin-ngo-status" className="form-control input-no-prefix" value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}>
            {['pending', 'active', 'rejected', 'deactivated'].map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
        </FormField>
        {loading ? <Skeleton lines={3} /> : users.length ? (
          <div className="reports-list">
            {users.map((user) => (
              <article className="report-item admin-list-item" key={user.id}>
                <div className="report-item-main">
                  <strong className="report-item-title">{user.organizationName || user.fullName}</strong>
                  <span className="report-item-location">{user.email} · {user.ngoType}</span>
                  <Badge tone={user.status === 'active' ? 'score-green' : user.status === 'pending' ? 'score-yellow' : 'neutral'}>{user.status}</Badge>
                </div>
                <div className="dashboard-actions">
                  {['pending', 'rejected'].includes(user.status) && <>
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy === `user-${user.id}`} onClick={() => setAccountStatus(user, 'active')}>{user.status === 'pending' ? 'Approve' : 'Restore approval'}</button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `user-${user.id}`} onClick={() => setAccountStatus(user, 'rejected')}>Reject</button>
                  </>}
                  {user.status !== 'deactivated' && user.status !== 'rejected' && (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `user-${user.id}` || user.id === currentUser?.id}
                      onClick={() => setAccountStatus(user, 'deactivated')}>Deactivate</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No NGOs match this status" />}
      </section>

      <section className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">Account access</h3>
          <p className="card-subtitle">Restore deactivated accounts or deactivate accounts that should no longer access the portals.</p>
        </div>
        <FormField label="Account status" htmlFor="admin-account-status">
          <select id="admin-account-status" className="form-control input-no-prefix" value={accountStatusFilter}
            onChange={(event) => setAccountStatusFilter(event.target.value)}>
            <option value="deactivated">Deactivated</option>
            <option value="active">Active</option>
          </select>
        </FormField>
        {loading ? <Skeleton lines={3} /> : activeAccounts.length ? (
          <div className="reports-list">
            {activeAccounts.map((user) => (
              <article className="report-item admin-list-item" key={user.id}>
                <div className="report-item-main">
                  <strong className="report-item-title">{user.fullName}</strong>
                  <span className="report-item-location">{user.email} · {user.role}</span>
                </div>
                <button type="button"
                  className={`btn ${user.status === 'deactivated' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  disabled={busy === `user-${user.id}` || user.id === currentUser?.id}
                  onClick={() => setAccountStatus(user, user.status === 'deactivated' ? 'active' : 'deactivated')}>
                  {user.status === 'deactivated' ? 'Activate account' : 'Deactivate'}
                </button>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No active accounts" />}
      </section>

      <section className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">Place moderation</h3>
          <p className="card-subtitle">Hide or restore a place in public location lists and scores.</p>
        </div>
        {loading ? <Skeleton lines={3} /> : locations.length ? (
          <div className="reports-list">
            {locations.map((place) => (
              <article className="report-item admin-list-item" key={place.id}>
                <div className="report-item-main">
                  <strong className="report-item-title">{place.name}</strong>
                  <span className="report-item-location">{place.isUserAdded ? 'Citizen-added' : 'Seeded place'} · {place.status}</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `place-${place.id}`}
                  onClick={() => setPlaceStatus(place, place.status === 'active' ? 'hidden' : 'active')}>
                  {place.status === 'active' ? 'Hide' : 'Restore'}
                </button>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No places found" />}
      </section>

      <section className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">Audit log</h3>
          <p className="card-subtitle">Administrative and authority actions are recorded with actor and timestamp.</p>
        </div>
        <div className="filters-grid">
          <FormField label="Filter action" htmlFor="audit-action">
            <input id="audit-action" className="form-control input-no-prefix" value={auditAction} maxLength={80}
              placeholder="e.g. report_resolved" onChange={(event) => setAuditAction(event.target.value)} />
          </FormField>
          <FormField label="Search actor or details" htmlFor="audit-search">
            <input id="audit-search" className="form-control input-no-prefix" value={auditQuery} maxLength={120}
              onChange={(event) => setAuditQuery(event.target.value)} />
          </FormField>
        </div>
        {loading ? <Skeleton lines={4} /> : audit.length ? (
          <div className="audit-list">
            {audit.map((entry) => (
              <article className="audit-entry" key={entry.id}>
                <div><strong>{entry.action.replaceAll('_', ' ')}</strong><span>{entry.recordType} #{entry.recordId}</span></div>
                <p>{entry.details}</p>
                <small>{entry.actorName} · {entry.actorEmail} · {new Date(entry.createdAt).toLocaleString()}</small>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No audit entries match" />}
      </section>
    </div>
  );
}
