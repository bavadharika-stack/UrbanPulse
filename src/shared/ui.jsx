import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function Button({ variant = 'primary', size = '', type = 'button', className = '', children, ...props }) {
  return (
    <button type={type} className={`btn btn-${variant}${size ? ` btn-${size}` : ''} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function Card({ as: Component = 'section', className = '', children, ...props }) {
  return <Component className={`card ${className}`.trim()} {...props}>{children}</Component>;
}

export function Badge({ tone = 'neutral', children, className = '', ...props }) {
  return <span className={`ui-badge ui-badge-${tone} ${className}`.trim()} {...props}>{children}</span>;
}

export function Modal({ open, title, onClose, children }) {
  const dialogRef = React.useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = [...dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ui-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title" tabIndex="-1">
        <div className="ui-modal-heading">
          <h2 id="ui-modal-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const notify = useCallback((message, tone = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div className={`ui-toast ui-toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'} key={toast.id}>
            {toast.tone === 'success' ? <CheckCircle2 size={17} /> : <Info size={17} />}
            <span>{toast.message}</span>
            <button type="button" className="icon-button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}><X size={15} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast must be used within ToastProvider.');
  return notify;
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <Info size={22} aria-hidden="true" />
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton-group ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, index) => <span className="skeleton-line" key={index} />)}
    </div>
  );
}

export function FormField({ label, htmlFor, error, children, className = '' }) {
  return (
    <div className={`form-group ${className}`}>
      <label className="form-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <span className="form-error" role="alert">{error}</span>}
    </div>
  );
}
