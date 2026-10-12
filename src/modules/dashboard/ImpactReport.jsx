import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { downloadImpactPdf, getImpactReport } from '../../api';
import reportCategories from '../../../shared/reportCategories.json';
import { Badge, Button, EmptyState, FormField, Skeleton } from '../../shared/ui';
import ReportPhotos from '../../shared/ReportPhotos';

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function ImpactReport({ currentUser }) {
  const [filters, setFilters] = useState({
    month: currentMonth(),
    category: currentUser?.role === 'ngo' ? currentUser.ngoType || '' : '',
    area: '',
    ngoId: currentUser?.role === 'ngo' ? String(currentUser.id) : '',
  });
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getImpactReport(filters)
      .then((result) => { if (active) setImpact(result); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters.month, filters.category, filters.area, filters.ngoId]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const blob = await downloadImpactPdf(filters);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `urbanpulse-impact-${filters.month}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenPdfForPrinting = async () => {
    const printTab = window.open('about:blank', '_blank');
    if (!printTab) {
      setError('Allow pop-ups for this site to open the print-ready report.');
      return;
    }

    setError('');
    try {
      const blob = await downloadImpactPdf(filters);
      const pdfUrl = URL.createObjectURL(blob);
      printTab.location.href = pdfUrl;
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (downloadError) {
      printTab.close();
      setError(downloadError.message);
    }
  };

  const metrics = [
    ['found', 'Reports found'],
    ['accepted', 'Accepted'],
    ['verified', 'Verified'],
    ['resolved', 'Resolved'],
    ['pending', 'Still pending'],
  ];

  return (
    <div className="dashboard-container impact-page">
      <section className="card impact-print-header">
        <div className="user-role-tag">Monthly NGO performance</div>
        <h2 className="dashboard-title">NGO Impact Report</h2>
        <p className="dashboard-subtitle">
          {impact ? `${impact.ngoName} · ${impact.dateRange.start} to ${impact.dateRange.end}` : 'Review monthly issue response and resolution.'}
        </p>
      </section>

      <section className="card mt-3 impact-controls">
        <div className="impact-filter-grid">
          <FormField label="Month" htmlFor="impact-month">
            <input id="impact-month" type="month" className="form-control input-no-prefix"
              max={currentMonth()} value={filters.month} onChange={(event) => updateFilter('month', event.target.value)} />
          </FormField>
          <FormField label="Area" htmlFor="impact-area">
            <input id="impact-area" type="search" className="form-control input-no-prefix"
              maxLength={120} placeholder="All areas" value={filters.area}
              onChange={(event) => updateFilter('area', event.target.value)} />
          </FormField>
          <FormField label="Category" htmlFor="impact-category">
            <select id="impact-category" className="form-control input-no-prefix"
              value={filters.category} disabled={currentUser?.role === 'ngo'}
              onChange={(event) => updateFilter('category', event.target.value)}>
              <option value="">All categories</option>
              {reportCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </FormField>
          {impact?.availableNgos?.length > 0 && (
            <FormField label="NGO" htmlFor="impact-ngo">
              <select id="impact-ngo" className="form-control input-no-prefix"
                value={filters.ngoId} onChange={(event) => updateFilter('ngoId', event.target.value)}>
                <option value="">All NGOs</option>
                {impact.availableNgos.map((ngo) => <option value={ngo.id} key={ngo.id}>{ngo.name}</option>)}
              </select>
            </FormField>
          )}
        </div>
        <div className="dashboard-actions impact-actions">
          <Button variant="secondary" onClick={handleOpenPdfForPrinting} disabled={loading || !impact}>
            <Printer size={16} /><span>Open PDF to print</span>
          </Button>
          <Button disabled={downloading || loading || !impact} onClick={handleDownload}>
            <Download size={16} /><span>{downloading ? 'Preparing PDF…' : 'Download as PDF'}</span>
          </Button>
        </div>
      </section>

      {error && <div className="alert alert-error mt-3" role="alert">{error}</div>}
      {loading ? <div className="card mt-3"><Skeleton lines={5} /></div> : impact && (
        <>
          <section className="card mt-3">
            <div className="impact-report-title">
              <div>
                <h3 className="card-title">{impact.ngoName}</h3>
                <p className="card-subtitle">{impact.dateRange.start} through {impact.dateRange.end}</p>
              </div>
              {impact.category && <Badge tone="status">{impact.category}</Badge>}
            </div>
            <div className="activity-stats-grid impact-stats-grid">
              {metrics.map(([key, label]) => (
                <div className="stat-card" key={key}>
                  <div className="stat-number">{impact.summary[key]}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
              <div className="stat-card">
                <div className="stat-number">
                  {impact.summary.averageResolutionHours === null ? '—' : `${impact.summary.averageResolutionHours}h`}
                </div>
                <div className="stat-label">Average time to resolve</div>
              </div>
            </div>
          </section>

          <section className="card mt-3">
            <h3 className="card-title">Top problem places</h3>
            {impact.topPlaces.length ? (
              <ol className="impact-place-list">
                {impact.topPlaces.map((place) => (
                  <li key={place.location}><span>{place.location}</span><Badge tone="neutral">{place.reportCount} reports</Badge></li>
                ))}
              </ol>
            ) : <EmptyState title="No reports for this selection" description="Try another month, area, or category." />}
          </section>

          <section className="card mt-3">
            <h3 className="card-title">Resolved issues: before and after</h3>
            {impact.resolvedGallery.length ? (
              <div className="impact-gallery">
                {impact.resolvedGallery.map((report) => (
                  <article className="impact-gallery-item" key={report.id}>
                    <strong>{report.title}</strong>
                    <span>{report.location}</span>
                    <ReportPhotos report={report} />
                  </article>
                ))}
              </div>
            ) : <EmptyState title="No before/after photos yet" description="Resolved reports with an after photo will appear here." />}
          </section>
        </>
      )}
    </div>
  );
}
