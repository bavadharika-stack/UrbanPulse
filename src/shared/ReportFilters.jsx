import React from 'react';
import { Button, FormField } from './ui';

export function ReportFilters({ filters, onChange, categories = [], departments = [], showDepartment = false, showPriority = false }) {
  return (
    <div className="filters-grid" aria-label="Report search and filters">
      <FormField label="Search reports" htmlFor="report-filter-search" className="filter-field">
        <input id="report-filter-search" className="form-control input-no-prefix" type="search" maxLength={120}
          value={filters.q || ''} placeholder="Title, location or details"
          onChange={(event) => onChange({ q: event.target.value, page: '1' })} />
      </FormField>
      <FormField label="Category" htmlFor="report-filter-category" className="filter-field">
        <select id="report-filter-category" className="form-control input-no-prefix" value={filters.category || ''}
          onChange={(event) => onChange({ category: event.target.value, page: '1' })}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </FormField>
      <FormField label="Status" htmlFor="report-filter-status" className="filter-field">
        <select id="report-filter-status" className="form-control input-no-prefix" value={filters.status || ''}
          onChange={(event) => onChange({ status: event.target.value, page: '1' })}>
          <option value="">All statuses</option>
          {['pending', 'accepted', 'in_progress', 'resolved'].map((status) => (
            <option key={status} value={status}>{status.replace('_', ' ')}</option>
          ))}
        </select>
      </FormField>
      <FormField label="From date" htmlFor="report-filter-from" className="filter-field">
        <input id="report-filter-from" className="form-control input-no-prefix" type="date" value={filters.from || ''}
          max={filters.to || undefined}
          onChange={(event) => onChange({ from: event.target.value, page: '1' })} />
      </FormField>
      <FormField label="To date" htmlFor="report-filter-to" className="filter-field">
        <input id="report-filter-to" className="form-control input-no-prefix" type="date" value={filters.to || ''}
          min={filters.from || undefined}
          onChange={(event) => onChange({ to: event.target.value, page: '1' })} />
      </FormField>
      {showDepartment && (
        <FormField label="Department" htmlFor="report-filter-department" className="filter-field">
          <select id="report-filter-department" className="form-control input-no-prefix" value={filters.department || ''}
            onChange={(event) => onChange({ department: event.target.value, page: '1' })}>
            <option value="">All departments</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
        </FormField>
      )}
      {showPriority && (
        <FormField label="Priority" htmlFor="report-filter-priority" className="filter-field">
          <select id="report-filter-priority" className="form-control input-no-prefix" value={filters.priority || ''}
            onChange={(event) => onChange({ priority: event.target.value, page: '1' })}>
            <option value="">All priorities</option>
            {['low', 'medium', 'high', 'critical'].map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
        </FormField>
      )}
    </div>
  );
}

export function PaginationControls({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="pagination-controls" aria-label="Report pages">
      <span aria-live="polite">
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} reports
      </span>
      <div className="dashboard-actions">
        <Button variant="secondary" size="sm" disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}>Previous</Button>
        <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}>Next</Button>
      </div>
    </div>
  );
}
