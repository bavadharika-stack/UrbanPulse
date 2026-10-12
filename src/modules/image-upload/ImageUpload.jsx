import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import {
  Camera,
  Upload,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  MapPin,
  FileText,
} from 'lucide-react';
import { confirmReport, createReport, getLocations } from '../../api';
import reportCategories from '../../../shared/reportCategories.json';
import { Button, FormField, Modal } from '../../shared/ui';
import VoiceInputButton from '../../shared/VoiceInputButton';
import { useI18n } from '../../i18n/I18nProvider';
import { findNearestPlace } from '../../shared/nearestPlace.mjs';
import { suggestCategory } from '../../shared/categorySuggestion.mjs';

const reportPinIcon = L.divIcon({
  className: 'place-marker-wrapper',
  html: '<span class="place-marker" style="background:#0284c7"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function ReportLocationPin({ position, onChange }) {
  useMapEvents({
    click({ latlng }) {
      onChange({ latitude: latlng.lat, longitude: latlng.lng });
    },
  });
  return position ? (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={reportPinIcon}
      draggable
      eventHandlers={{
        dragend(event) {
          const point = event.target.getLatLng();
          onChange({ latitude: point.lat, longitude: point.lng });
        },
      }}
    />
  ) : null;
}

export default function ImageUpload({
  currentUser,
  onBackToDashboard,
  initialLocation = '',
  initialPhoto = null,
  quickReport = false,
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    location: initialLocation,
    category: '',
    title: '',
    description: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);
  const [duplicateReport, setDuplicateReport] = useState(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [confirmationOnly, setConfirmationOnly] = useState(false);
  const [isConfirmingDuplicate, setIsConfirmingDuplicate] = useState(false);
  const [autoCategory, setAutoCategory] = useState('');
  const [categoryManuallyChanged, setCategoryManuallyChanged] = useState(false);
  const [findingLocation, setFindingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [mapPoint, setMapPoint] = useState(null);

  const fileInputRef = useRef(null);
  const imagePreviewUrlRef = useRef('');

  const updateImagePreview = (url) => {
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
    imagePreviewUrlRef.current = url;
    setImagePreviewUrl(url);
  };

  // Format file size into human-readable string
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // Handle text input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (['title', 'description'].includes(name) && !categoryManuallyChanged) {
      const nextCategory = suggestCategory(`${name === 'title' ? value : formData.title} ${name === 'description' ? value : formData.description}`);
      if (nextCategory && reportCategories.includes(nextCategory)) {
        setAutoCategory(nextCategory);
        setFormData((prev) => ({ ...prev, category: nextCategory }));
      } else if (autoCategory && formData.category === autoCategory) {
        setAutoCategory('');
        setFormData((prev) => ({ ...prev, category: '' }));
      }
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (generalError) {
      setGeneralError('');
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSelectedFile(null);
      updateImagePreview('');
      setErrors((prev) => ({
        ...prev,
        image: t('Please select a valid image file (JPG, PNG, WebP).'),
      }));
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null);
      updateImagePreview('');
      setErrors((prev) => ({
        ...prev,
        image: t('Image must be 5 MB or smaller.'),
      }));
      e.target.value = '';
      return;
    }

    setErrors((prev) => ({ ...prev, image: '' }));
    if (generalError) setGeneralError('');
    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    updateImagePreview(previewUrl);
  };

  const addVoiceTranscript = (field, transcript) => {
    setFormData((current) => ({
      ...current,
      [field]: current[field] ? `${current[field].trimEnd()} ${transcript}` : transcript,
    }));
    if (field === 'description' && !categoryManuallyChanged) {
      const nextCategory = suggestCategory(`${formData.title} ${formData.description} ${transcript}`);
      if (nextCategory && reportCategories.includes(nextCategory)) {
        setAutoCategory(nextCategory);
        setFormData((current) => ({ ...current, category: nextCategory }));
      } else if (autoCategory && formData.category === autoCategory) {
        setAutoCategory('');
        setFormData((current) => ({ ...current, category: '' }));
      }
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage(t('Location unavailable. Enter the area or choose a place on the map.'));
      return;
    }
    setFindingLocation(true);
    setLocationMessage('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const locations = await getLocations();
        const nearest = findNearestPlace(
          { latitude: coords.latitude, longitude: coords.longitude },
          locations,
          10_000,
        );
        if (nearest) {
          setFormData((current) => ({ ...current, location: nearest.place.name }));
          setLocationMessage(nearest.place.name);
        } else {
          setMapPoint({ latitude: coords.latitude, longitude: coords.longitude });
          setShowLocationMap(true);
          setLocationMessage(t('We couldn’t find a nearby saved place. Enter the area or choose a place on the map.'));
        }
      } catch (error) {
        setLocationMessage(error.message || t('We couldn’t find a nearby saved place. Enter the area or choose a place on the map.'));
      } finally {
        setFindingLocation(false);
      }
    }, (error) => {
      setFindingLocation(false);
      setLocationMessage(error.code === error.PERMISSION_DENIED
        ? t('Location permission was denied. You can still enter the place manually.')
        : t('Location unavailable. Enter the area or choose a place on the map.'));
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
  };

  const selectMapPoint = ({ latitude, longitude }) => {
    setMapPoint({ latitude, longitude });
    setFormData((current) => ({
      ...current,
      location: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    }));
  };

  // Trigger hidden file input
  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  // Remove the selected image
  const handleRemoveImage = () => {
    setSelectedFile(null);
    updateImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Validate form fields
  const validateForm = () => {
    const newErrors = {};

    if (!formData.location.trim()) {
      newErrors.location = t('Please enter the location or area.');
    }

    if (!formData.category) {
      newErrors.category = t('Please select an issue category.');
    }

    if (!formData.title.trim()) {
      newErrors.title = t('Please enter an issue title.');
    }

    if (!formData.description.trim()) {
      newErrors.description = t('Please provide an issue description.');
    }

    if (!selectedFile) {
      newErrors.image = t('Please select an image.');
    }

    setErrors(newErrors);

    const hasErrors = Object.keys(newErrors).length > 0;
    if (hasErrors) {
      setGeneralError(t('Please fill in all required fields and attach an image.'));
    }

    return !hasErrors;
  };

  // Submit the report
  const submitReport = async (submitAnyway = false) => {
    setGeneralError('');
    setIsSubmitting(true);
    try {
      await createReport({
        title: formData.title.trim(),
        location: formData.location.trim(),
        category: formData.category,
        description: formData.description.trim(),
        image: selectedFile,
        submitAnyway,
      });

      setDuplicateReport(null);
      setConfirmationOnly(false);
      setIsSubmitted(true);
      setSubmittedReport({
        location: formData.location.trim(),
        category: formData.category,
        title: formData.title.trim(),
        description: formData.description.trim(),
        fileName: selectedFile.name,
        fileSize: formatFileSize(selectedFile.size),
        previewUrl: imagePreviewUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (error) {
      if (error.payload?.code === 'REPORT_POSSIBLE_DUPLICATE' && error.payload.report) {
        setDuplicateReport(error.payload.report);
        setGeneralError('');
        return;
      }
      setGeneralError(error.message || 'Could not submit the report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    await submitReport(allowDuplicate);
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateReport) return;
    setIsConfirmingDuplicate(true);
    setGeneralError('');
    try {
      await confirmReport(duplicateReport.id);
      setConfirmationOnly(true);
      setSubmittedReport(null);
      setDuplicateReport(null);
      setIsSubmitted(true);
    } catch (error) {
      setGeneralError(error.message || 'Could not confirm this report.');
    } finally {
      setIsConfirmingDuplicate(false);
    }
  };

  // Reset form to submit another report
  const handleReset = () => {
    updateImagePreview('');
    setFormData({
      location: initialLocation,
      category: '',
      title: '',
      description: '',
    });
    setAutoCategory('');
    setCategoryManuallyChanged(false);
    setLocationMessage('');
    setMapPoint(null);
    setShowLocationMap(false);
    setSelectedFile(null);
    setErrors({});
    setGeneralError('');
    setDuplicateReport(null);
    setAllowDuplicate(false);
    setConfirmationOnly(false);
    setIsSubmitted(false);
    setSubmittedReport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => () => {
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
  }, []);

  useEffect(() => {
    if (!initialPhoto) return;
    setSelectedFile(initialPhoto);
    updateImagePreview(URL.createObjectURL(initialPhoto));
  }, [initialPhoto]);

  // ==========================================
  // Success Confirmation Screen
  // ==========================================
  if (isSubmitted) {
    return (
      <div className="upload-card-container">
        <div className="card text-center" id="report-success-view">
          <div className="success-icon-badge">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="card-title">{confirmationOnly ? t('Thanks for confirming this report.') : t('Report submitted successfully.')}</h2>
          <p className="card-subtitle">
            {confirmationOnly
              ? t('Your confirmation was added to the existing issue and its priority has been updated.')
              : t('Your issue details and photo evidence have been recorded for municipal action.')}
          </p>

          {/* Submitted Report Summary */}
          {submittedReport && (
            <div className="info-box mt-3" style={{ textAlign: 'left' }}>
              <div className="info-row">
                <span className="info-label">{t('Location:')}</span>
                <span className="info-value">{submittedReport.location}</span>
              </div>
              <div className="info-row">
                <span className="info-label">{t('Issue Title:')}</span>
                <span className="info-value">{submittedReport.title}</span>
              </div>
              <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
                <span className="info-label">{t('Description:')}</span>
                <span className="info-value" style={{ fontWeight: 400, color: '#334155' }}>
                  {submittedReport.description}
                </span>
              </div>

              {/* Submitted Image Preview */}
              {submittedReport.previewUrl && (
                <div className="image-preview-card mt-3">
                  <div className="image-preview-wrapper" style={{ maxHeight: '180px' }}>
                    <img
                      src={submittedReport.previewUrl}
                      alt={t('Submitted evidence')}
                      className="image-preview-img"
                      style={{ maxHeight: '180px' }}
                    />
                  </div>
                  <div className="image-preview-footer">
                    <div>
                      <div className="file-info-name">{submittedReport.fileName}</div>
                      <div className="file-info-size">
                        {submittedReport.fileSize} • Submitted at {submittedReport.timestamp}
                      </div>
                    </div>
                    <span className="status-indicator">
                      <span className="status-dot"></span>
                      <span>{t('Recorded')}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Actions */}
          <div className="upload-actions-row">
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={handleReset}
            >
              <RefreshCw size={15} />
              <span>{t('Submit Another Report')}</span>
            </button>
            <button
              type="button"
              id="btn-back-to-dashboard-success"
              className="btn btn-primary btn-block"
              onClick={onBackToDashboard}
            >
              <ArrowLeft size={16} />
              <span>{t('Back to Dashboard')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Report an Issue Form
  // ==========================================
  return (
    <div className="upload-card-container">
      <div className="card" id="report-issue-card">
        {/* Header */}
        <div className="card-header">
          <button
            type="button"
            className="link-button mb-2"
            onClick={onBackToDashboard}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}
          >
            <ArrowLeft size={15} />
            <span>{t('Back to Dashboard')}</span>
          </button>
          <h2 className="card-title">{quickReport ? t('Quick report') : t('Report an Issue')}</h2>
          <p className="card-subtitle">
            {t('Provide details and photo evidence of the public space issue for municipal review.')}
          </p>
          {quickReport && <span className="quick-report-step">{t('Photo added. Add the location and details to finish your report.')}</span>}
        </div>

        {/* Top General Validation Alert */}
        {generalError && (
          <div className="alert alert-error" role="alert" id="report-error-alert">
            <AlertCircle size={18} className="alert-icon" />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* 1. Location / Area */}
          <FormField label={<>{t('Location / Area')} <span className="text-danger">*</span></>} htmlFor="report-location" error={errors.location}>
            <div className="input-group">
              <span className="input-prefix">
                <MapPin size={17} />
              </span>
              <input
                id="report-location"
                name="location"
                type="text"
                className={`form-control ${errors.location ? 'is-invalid' : ''}`}
                placeholder={t('e.g. Anna Nagar, Chennai')}
                value={formData.location}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            <button type="button" className="btn btn-secondary btn-sm mt-1" onClick={useCurrentLocation} disabled={findingLocation || isSubmitting}>
              <MapPin size={15} /><span>{t(findingLocation ? 'Finding your location…' : 'Use my location')}</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm mt-1" onClick={() => setShowLocationMap((visible) => !visible)} aria-expanded={showLocationMap}>
              <MapPin size={15} /><span>{t(showLocationMap ? 'Close map picker' : 'Choose on map')}</span>
            </button>
            {locationMessage && <span className="location-hint" role="status">{locationMessage}</span>}
            {showLocationMap && (
              <div className="report-location-map" aria-label={t('Choose report location on map')}>
                <p className="card-subtitle">{t('Tap the map or drag the pin to set the issue location.')}</p>
                <MapContainer
                  center={mapPoint ? [mapPoint.latitude, mapPoint.longitude] : [13.0475, 80.2209]}
                  zoom={mapPoint ? 15 : 11}
                  scrollWheelZoom={false}
                  className="report-location-map-canvas"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ReportLocationPin position={mapPoint} onChange={selectMapPoint} />
                </MapContainer>
                {mapPoint && <span className="location-hint" role="status">
                  {t('Selected coordinates')}: {mapPoint.latitude.toFixed(5)}, {mapPoint.longitude.toFixed(5)}
                </span>}
              </div>
            )}
          </FormField>

          {/* 2. Issue Category */}
          <div className="form-group">
            <label htmlFor="report-category" className="form-label">
              {t('Issue Category')} <span className="text-danger">*</span>
            </label>
            <select
              id="report-category"
              name="category"
              className={`form-control ${errors.category ? 'is-invalid' : ''}`}
              value={formData.category}
              onChange={(event) => {
                setCategoryManuallyChanged(true);
                setAutoCategory('');
                handleInputChange(event);
              }}
              disabled={isSubmitting}
              required
            >
              <option value="">— {t('Select a category')} —</option>
              {reportCategories.map((category) => (
                <option key={category} value={category}>{t(category)}</option>
              ))}
            </select>
            {autoCategory && !categoryManuallyChanged && (
              <span className="category-suggestion" role="status">{t('Suggested category')}: {t(autoCategory)}</span>
            )}
            {errors.category && <div className="form-feedback">{errors.category}</div>}
          </div>

          {/* 3. Issue Title */}
          <div className="form-group">
            <label htmlFor="report-title" className="form-label">
              {t('Issue Title')} <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <span className="input-prefix">
                <FileText size={17} />
              </span>
              <input
                id="report-title"
                name="title"
                type="text"
                className={`form-control ${errors.title ? 'is-invalid' : ''}`}
                placeholder={t('e.g. Damaged pathway')}
                value={formData.title}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            {errors.title && <div className="form-feedback">{errors.title}</div>}
          </div>

          {/* 3. Issue Description */}
          <div className="form-group">
            <label htmlFor="report-description" className="form-label">
              {t('Issue Description')} <span className="text-danger">*</span>
            </label>
            <VoiceInputButton onTranscript={(transcript) => addVoiceTranscript('description', transcript)} disabled={isSubmitting} />
            <textarea
              id="report-description"
              name="description"
              className={`form-control ${errors.description ? 'is-invalid' : ''}`}
              placeholder={t('Describe the issue, what is affected, and when it happens.')}
              value={formData.description}
              onChange={handleInputChange}
              disabled={isSubmitting}
              rows={3}
              required
            />
            {errors.description && <div className="form-feedback">{errors.description}</div>}
          </div>

          {/* 4. Image Upload & Preview */}
          <div className="form-group">
            <label className="form-label">
              {t('Evidence Image')} <span className="text-danger">*</span>
            </label>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              id="report-image-input"
            />

            {!imagePreviewUrl ? (
              /* Dropzone / Upload button */
              <div
                className={`upload-dropzone ${errors.image ? 'is-invalid' : ''}`}
                onClick={handleSelectClick}
                id="image-dropzone"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectClick();
                  }
                }}
                style={errors.image ? { borderColor: '#ef4444', backgroundColor: '#fffbfa' } : {}}
              >
                <div className="upload-dropzone-icon">
                  <Camera size={24} />
                </div>
                <div className="upload-dropzone-text">{t('Click to select issue photo')}</div>
                <div className="upload-dropzone-hint">{t('JPG, PNG, or WebP; maximum 5 MB')}</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectClick();
                  }}
                >
                  <Upload size={14} />
                  <span>{t('Browse Files')}</span>
                </button>
              </div>
            ) : (
              /* Image Preview with controls */
              <div className="image-preview-card" id="image-preview-container">
                <div className="image-preview-wrapper">
                  <img
                    src={imagePreviewUrl}
                    alt={t('Issue photo preview')}
                    className="image-preview-img"
                  />
                </div>

                <div className="image-preview-footer">
                  <div>
                    <div className="file-info-name">{selectedFile?.name}</div>
                    <div className="file-info-size">{formatFileSize(selectedFile?.size)}</div>
                  </div>

                  <div className="preview-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleSelectClick}
                      title={t('Choose a different image')}
                    >
                      <RefreshCw size={13} />
                      <span>{t('Change')}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      onClick={handleRemoveImage}
                      title={t('Remove selected image')}
                      id="btn-remove-image"
                    >
                      <Trash2 size={13} />
                      <span>{t('Remove')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {errors.image && <div className="form-feedback">{errors.image}</div>}
          </div>

          {/* Action Buttons */}
          <div className="upload-actions-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onBackToDashboard}
            >
              <span>{t('Cancel')}</span>
            </button>

            <button
              id="btn-submit-report"
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border"></span>
                  <span>{t('Submitting Report...')}</span>
                </>
              ) : (
                <>
                  <span>{t('Submit Report')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <Modal
        open={Boolean(duplicateReport)}
        title={t('A similar issue already exists')}
        onClose={() => setDuplicateReport(null)}
      >
        {duplicateReport && (
          <div className="duplicate-report-prompt">
            <p>{t('There is already an open report at this location that may describe the same issue:')}</p>
            <strong>{duplicateReport.title}</strong>
            <span>{duplicateReport.location} · {duplicateReport.category}</span>
            <p>{duplicateReport.description}</p>
            <div className="dashboard-actions">
              <Button variant="secondary" disabled={isConfirmingDuplicate} onClick={() => {
                setAllowDuplicate(true);
                setDuplicateReport(null);
                submitReport(true);
              }}>
                {t('Submit anyway')}
              </Button>
              {duplicateReport.citizenId !== currentUser?.id && (
                <Button disabled={isConfirmingDuplicate} onClick={handleConfirmDuplicate}>
                  {isConfirmingDuplicate ? t('Confirming…') : t('I see this too')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
