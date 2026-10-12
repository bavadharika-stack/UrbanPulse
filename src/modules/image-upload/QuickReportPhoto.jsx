import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function QuickReportPhoto({ onContinue, onCancel }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const handlePhoto = (event) => {
    const nextPhoto = event.target.files?.[0];
    if (!nextPhoto) return;
    if (!ALLOWED_IMAGE_TYPES.includes(nextPhoto.type)) {
      setError(t('Please select a valid image file (JPG, PNG, WebP).'));
      event.target.value = '';
      return;
    }
    if (nextPhoto.size > MAX_IMAGE_BYTES) {
      setError(t('Image must be 5 MB or smaller.'));
      event.target.value = '';
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(nextPhoto);
    setPreview(URL.createObjectURL(nextPhoto));
    setError('');
  };

  const removePhoto = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(null);
    setPreview('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="quick-report-page">
      <section className="card quick-report-card">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          <ArrowLeft size={16} /><span>{t('Back to Dashboard')}</span>
        </button>
        <div className="quick-report-heading">
          <span className="quick-report-icon"><ImagePlus size={21} aria-hidden="true" /></span>
          <div>
            <h2 className="card-title">{t('Quick report: add a photo')}</h2>
            <p className="card-subtitle">{t('Take or choose a photo first. You can add the location and details next.')}</p>
          </div>
        </div>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          aria-label={t('Take or choose photo')}
          onChange={handlePhoto}
        />
        {preview ? (
          <div className="quick-photo-preview">
            <img src={preview} alt={t('Issue photo preview')} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={removePhoto}>
              <Trash2 size={16} /><span>{t('Choose another photo')}</span>
            </button>
          </div>
        ) : (
          <button type="button" className="quick-photo-picker" onClick={() => inputRef.current?.click()}>
            <Camera size={32} aria-hidden="true" />
            <strong>{t('Take or choose photo')}</strong>
            <span>{t('JPG, PNG, or WebP; maximum 5 MB')}</span>
          </button>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="quick-report-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>{t('Cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!photo} onClick={() => onContinue(photo)}>
            <span>{t('Continue to report details')}</span><ArrowRight size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}
