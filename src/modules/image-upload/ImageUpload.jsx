import React, { useState, useRef } from 'react';
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
  AlignLeft,
} from 'lucide-react';
import { saveReport } from '../../shared/authStorage';

export default function ImageUpload({ onBackToDashboard }) {
  const [formData, setFormData] = useState({
    location: '',
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

  const fileInputRef = useRef(null);

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

    // Validate image format
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({
        ...prev,
        image: 'Please select a valid image file (JPG, PNG, WebP).',
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, image: '' }));
    if (generalError) setGeneralError('');

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
  };

  // Trigger hidden file input
  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  // Remove the selected image
  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Validate form fields
  const validateForm = () => {
    const newErrors = {};

    if (!formData.location.trim()) {
      newErrors.location = 'Please enter the location or area.';
    }

    if (!formData.category) {
      newErrors.category = 'Please select an issue category.';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Please enter an issue title.';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Please provide an issue description.';
    }

    if (!selectedFile) {
      newErrors.image = 'Please select an image.';
    }

    setErrors(newErrors);

    const hasErrors = Object.keys(newErrors).length > 0;
    if (hasErrors) {
      setGeneralError('Please fill in all required fields and attach an image.');
    }

    return !hasErrors;
  };

  // Submit the report
  const handleSubmit = (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // Read image as base64 so it can be stored and shown on NGO dashboard
    const readImageAsDataUrl = (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });

    readImageAsDataUrl(selectedFile).then((imageDataUrl) => {
      saveReport({
        title: formData.title.trim(),
        location: formData.location.trim(),
        category: formData.category,
        description: formData.description.trim(),
        fileName: selectedFile.name,
        imageDataUrl,
      });

      setTimeout(() => {
        setIsSubmitting(false);
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
        setIsSubmitting(false);
      }, 400);
    });
  };

  // Reset form to submit another report
  const handleReset = () => {
    setFormData({
      location: '',
      category: '',
      title: '',
      description: '',
    });
    setSelectedFile(null);
    setImagePreviewUrl('');
    setErrors({});
    setGeneralError('');
    setIsSubmitted(false);
    setSubmittedReport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
          <h2 className="card-title">Report submitted successfully.</h2>
          <p className="card-subtitle">
            Your issue details and photo evidence have been recorded for municipal action.
          </p>

          {/* Submitted Report Summary */}
          {submittedReport && (
            <div className="info-box mt-3" style={{ textAlign: 'left' }}>
              <div className="info-row">
                <span className="info-label">Location:</span>
                <span className="info-value">{submittedReport.location}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Issue Title:</span>
                <span className="info-value">{submittedReport.title}</span>
              </div>
              <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
                <span className="info-label">Description:</span>
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
                      alt="Submitted evidence"
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
                      <span>Recorded</span>
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
              <span>Submit Another Report</span>
            </button>
            <button
              type="button"
              id="btn-back-to-dashboard-success"
              className="btn btn-primary btn-block"
              onClick={onBackToDashboard}
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
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
            <span>Back to Dashboard</span>
          </button>
          <h2 className="card-title">Report an Issue</h2>
          <p className="card-subtitle">
            Provide details and photo evidence of the public space issue for municipal review.
          </p>
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
          <div className="form-group">
            <label htmlFor="report-location" className="form-label">
              Location / Area <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <span className="input-prefix">
                <MapPin size={17} />
              </span>
              <input
                id="report-location"
                name="location"
                type="text"
                className={`form-control ${errors.location ? 'is-invalid' : ''}`}
                placeholder="e.g. Anna Nagar, Chennai"
                value={formData.location}
                onChange={handleInputChange}
                disabled={isSubmitting}
                required
              />
            </div>
            {errors.location && <div className="form-feedback">{errors.location}</div>}
          </div>

          {/* 2. Issue Category */}
          <div className="form-group">
            <label htmlFor="report-category" className="form-label">
              Issue Category <span className="text-danger">*</span>
            </label>
            <select
              id="report-category"
              name="category"
              className={`form-control ${errors.category ? 'is-invalid' : ''}`}
              value={formData.category}
              onChange={handleInputChange}
              disabled={isSubmitting}
              required
            >
              <option value="">— Select a category —</option>
              <option value="Waste Management">Waste Management</option>
              <option value="Environment &amp; Green Spaces">Environment &amp; Green Spaces</option>
              <option value="Road &amp; Infrastructure">Road &amp; Infrastructure</option>
              <option value="Sanitation &amp; Cleanliness">Sanitation &amp; Cleanliness</option>
              <option value="Public Safety">Public Safety</option>
              <option value="Accessibility">Accessibility</option>
            </select>
            {errors.category && <div className="form-feedback">{errors.category}</div>}
          </div>

          {/* 3. Issue Title */}
          <div className="form-group">
            <label htmlFor="report-title" className="form-label">
              Issue Title <span className="text-danger">*</span>
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
                placeholder="e.g. Damaged pathway"
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
              Issue Description <span className="text-danger">*</span>
            </label>
            <textarea
              id="report-description"
              name="description"
              className={`form-control ${errors.description ? 'is-invalid' : ''}`}
              placeholder="e.g. The pathway near the park entrance is damaged and difficult for pedestrians to use."
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
              Evidence Image <span className="text-danger">*</span>
            </label>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
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
                <div className="upload-dropzone-text">Click to select issue photo</div>
                <div className="upload-dropzone-hint">Supports JPG, PNG, or WebP format</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectClick();
                  }}
                >
                  <Upload size={14} />
                  <span>Browse Files</span>
                </button>
              </div>
            ) : (
              /* Image Preview with controls */
              <div className="image-preview-card" id="image-preview-container">
                <div className="image-preview-wrapper">
                  <img
                    src={imagePreviewUrl}
                    alt="Public space issue preview"
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
                      title="Choose a different image"
                    >
                      <RefreshCw size={13} />
                      <span>Change</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      onClick={handleRemoveImage}
                      title="Remove selected image"
                      id="btn-remove-image"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
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
              <span>Cancel</span>
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
                  <span>Submitting Report...</span>
                </>
              ) : (
                <>
                  <span>Submit Report</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
