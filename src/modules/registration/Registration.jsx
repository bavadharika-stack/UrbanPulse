import React, { useState } from 'react';
import { User, Building2, Mail, Lock, Eye, EyeOff, Tag, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { saveUser } from '../../shared/authStorage';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Registration({ onNavigateToLogin }) {
  const [accountType, setAccountType] = useState('citizen'); // 'citizen' | 'ngo'
  const [formData, setFormData] = useState({
    fullName: '',
    organizationName: '',
    email: '',
    password: '',
    confirmPassword: '',
    ngoType: '',
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Switch account type and clear field errors
  const handleAccountTypeChange = (type) => {
    setAccountType(type);
    setErrors({});
    setServerError('');
  };

  // Validation for individual fields
  const validateField = (name, value, currentForm = formData, currentAccountType = accountType) => {
    let error = '';

    if (name === 'fullName' && currentAccountType === 'citizen') {
      if (!value.trim()) {
        error = 'Full name is required.';
      } else if (value.trim().length < 2) {
        error = 'Full name must be at least 2 characters.';
      }
    } else if (name === 'organizationName' && currentAccountType === 'ngo') {
      if (!value.trim()) {
        error = 'Organization name is required.';
      } else if (value.trim().length < 2) {
        error = 'Organization name must be at least 2 characters.';
      }
    } else if (name === 'ngoType' && currentAccountType === 'ngo') {
      if (!value) {
        error = 'Please select an NGO type.';
      }
    } else if (name === 'email') {
      if (!value.trim()) {
        error = 'Email address is required.';
      } else if (!EMAIL_REGEX.test(value.trim())) {
        error = 'Please enter a valid email address.';
      }
    } else if (name === 'password') {
      if (!value) {
        error = 'Password is required.';
      } else if (value.length < 6) {
        error = 'Password must be at least 6 characters.';
      }
    } else if (name === 'confirmPassword') {
      if (!value) {
        error = 'Please confirm your password.';
      } else if (value !== currentForm.password) {
        error = 'Passwords do not match.';
      }
    }

    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...formData, [name]: value };
    setFormData(updatedForm);

    if (serverError) setServerError('');

    const error = validateField(name, value, updatedForm, accountType);
    setErrors((prev) => ({ ...prev, [name]: error }));

    if (name === 'password' && formData.confirmPassword) {
      const confirmErr = validateField('confirmPassword', formData.confirmPassword, updatedForm, accountType);
      setErrors((prev) => ({ ...prev, confirmPassword: confirmErr }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setServerError('');

    // Validate all fields based on account type
    let newErrors = {};
    if (accountType === 'citizen') {
      newErrors = {
        fullName: validateField('fullName', formData.fullName, formData, 'citizen'),
        email: validateField('email', formData.email, formData, 'citizen'),
        password: validateField('password', formData.password, formData, 'citizen'),
        confirmPassword: validateField('confirmPassword', formData.confirmPassword, formData, 'citizen'),
      };
    } else {
      newErrors = {
        organizationName: validateField('organizationName', formData.organizationName, formData, 'ngo'),
        email: validateField('email', formData.email, formData, 'ngo'),
        password: validateField('password', formData.password, formData, 'ngo'),
        confirmPassword: validateField('confirmPassword', formData.confirmPassword, formData, 'ngo'),
        ngoType: validateField('ngoType', formData.ngoType, formData, 'ngo'),
      };
    }

    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((err) => Boolean(err));
    if (hasErrors) return;

    setIsLoading(true);

    // Save to local storage demo
    setTimeout(() => {
      const result = saveUser({
        fullName: formData.fullName,
        organizationName: formData.organizationName,
        email: formData.email,
        password: formData.password,
        role: accountType,
        ngoType: formData.ngoType,
      });

      if (!result.success) {
        setServerError(result.message);
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setRegisteredUser(result.user);
      setIsLoading(false);
    }, 300);
  };

  const handleReset = () => {
    setFormData({
      fullName: '',
      organizationName: '',
      email: '',
      password: '',
      confirmPassword: '',
      ngoType: '',
    });
    setErrors({});
    setServerError('');
    setIsSuccess(false);
    setRegisteredUser(null);
  };

  // Success view
  if (isSuccess) {
    const isNgo = registeredUser?.role === 'ngo';
    return (
      <div className="auth-page-container">
        <div className="card text-center" id="registration-success-view">
          <div className="success-icon-badge">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="card-title">
            {isNgo ? 'NGO Account Created' : 'Account Created Successfully'}
          </h2>
          <p className="card-subtitle">
            Welcome to UrbanPulse, <strong>{registeredUser?.fullName || registeredUser?.organizationName}</strong>. Your {isNgo ? 'NGO' : 'citizen'} account is ready.
          </p>

          <div className="info-box">
            <div className="info-row">
              <span className="info-label">Registered Email:</span>
              <span className="info-value">{registeredUser?.email}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Account Role:</span>
              <span className="info-value">{isNgo ? 'NGO Organization' : 'Citizen Contributor'}</span>
            </div>
            {isNgo && registeredUser?.ngoType && (
              <div className="info-row">
                <span className="info-label">NGO Type:</span>
                <span className="info-value">{registeredUser.ngoType}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            id="btn-goto-login"
            className="btn btn-primary btn-block"
            onClick={() => onNavigateToLogin?.(registeredUser?.email)}
          >
            <span>Proceed to Sign In</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-block mt-2"
            onClick={handleReset}
          >
            Register Another Account
          </button>
        </div>
      </div>
    );
  }

  // Registration Form
  return (
    <div className="auth-page-container">
      <div className="card" id="registration-card">
        <div className="card-header">
          <h2 className="card-title">
            {accountType === 'ngo' ? 'Create NGO Account' : 'Create Citizen Account'}
          </h2>
          <p className="card-subtitle">
            {accountType === 'ngo'
              ? 'Register your organization to coordinate and address civic community initiatives.'
              : 'Register to participate in public space reporting and community feedback.'}
          </p>
        </div>

        {/* Account Type Option */}
        <div className="form-group">
          <label className="form-label">Account Type</label>
          <div className="account-type-grid" role="radiogroup" aria-label="Account Type">
            <button
              type="button"
              id="account-type-citizen"
              className={`account-type-btn ${accountType === 'citizen' ? 'active' : ''}`}
              onClick={() => handleAccountTypeChange('citizen')}
              aria-pressed={accountType === 'citizen'}
            >
              <User size={16} />
              <span>Citizen</span>
            </button>
            <button
              type="button"
              id="account-type-ngo"
              className={`account-type-btn ${accountType === 'ngo' ? 'active' : ''}`}
              onClick={() => handleAccountTypeChange('ngo')}
              aria-pressed={accountType === 'ngo'}
            >
              <Building2 size={16} />
              <span>NGO</span>
            </button>
          </div>
        </div>

        {serverError && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={18} className="alert-icon" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Citizen: Full Name */}
          {accountType === 'citizen' && (
            <div className="form-group">
              <label htmlFor="reg-fullName" className="form-label">
                Full Name <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-prefix">
                  <User size={17} />
                </span>
                <input
                  id="reg-fullName"
                  name="fullName"
                  type="text"
                  className={`form-control ${errors.fullName ? 'is-invalid' : ''}`}
                  placeholder="e.g. Priya Sharma"
                  value={formData.fullName}
                  onChange={handleChange}
                  disabled={isLoading}
                  autoComplete="name"
                  required
                />
              </div>
              {errors.fullName && <div className="form-feedback">{errors.fullName}</div>}
            </div>
          )}

          {/* NGO: Organization Name */}
          {accountType === 'ngo' && (
            <div className="form-group">
              <label htmlFor="reg-orgName" className="form-label">
                Organization Name <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-prefix">
                  <Building2 size={17} />
                </span>
                <input
                  id="reg-orgName"
                  name="organizationName"
                  type="text"
                  className={`form-control ${errors.organizationName ? 'is-invalid' : ''}`}
                  placeholder="e.g. Clean City Foundation"
                  value={formData.organizationName}
                  onChange={handleChange}
                  disabled={isLoading}
                  autoComplete="organization"
                  required
                />
              </div>
              {errors.organizationName && <div className="form-feedback">{errors.organizationName}</div>}
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label htmlFor="reg-email" className="form-label">
              Email Address <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <span className="input-prefix">
                <Mail size={17} />
              </span>
              <input
                id="reg-email"
                name="email"
                type="email"
                className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                placeholder={accountType === 'ngo' ? 'e.g. contact@cleancity.org' : 'e.g. priya.sharma@example.com'}
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="email"
                required
              />
            </div>
            {errors.email && <div className="form-feedback">{errors.email}</div>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="reg-password" className="form-label">
              Password <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <span className="input-prefix">
                <Lock size={17} />
              </span>
              <input
                id="reg-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="input-suffix-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password ? (
              <div className="form-feedback">{errors.password}</div>
            ) : (
              <div className="form-help">Minimum 6 characters required.</div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="reg-confirmPassword" className="form-label">
              Confirm Password <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <span className="input-prefix">
                <Lock size={17} />
              </span>
              <input
                id="reg-confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="input-suffix-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <div className="form-feedback">{errors.confirmPassword}</div>
            )}
          </div>

          {/* NGO Type (Only for NGO) */}
          {accountType === 'ngo' && (
            <div className="form-group">
              <label htmlFor="reg-ngoType" className="form-label">
                NGO Type <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-prefix">
                  <Tag size={17} />
                </span>
                <select
                  id="reg-ngoType"
                  name="ngoType"
                  className={`form-control select-control ${errors.ngoType ? 'is-invalid' : ''}`}
                  value={formData.ngoType}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                >
                  <option value="">Select NGO Type</option>
                  <option value="Waste Management">Waste Management</option>
                  <option value="Environment & Green Spaces">Environment & Green Spaces</option>
                  <option value="Road & Infrastructure">Road & Infrastructure</option>
                  <option value="Sanitation & Cleanliness">Sanitation & Cleanliness</option>
                  <option value="Public Safety">Public Safety</option>
                  <option value="Accessibility">Accessibility</option>
                </select>
              </div>
              {errors.ngoType && <div className="form-feedback">{errors.ngoType}</div>}
            </div>
          )}

          {/* Submit Button */}
          <button
            id="btn-register-submit"
            type="submit"
            className="btn btn-primary btn-block mt-3"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border"></span>
                <span>Registering Account...</span>
              </>
            ) : (
              <>
                <span>{accountType === 'ngo' ? 'Create NGO Account' : 'Create Citizen Account'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Link to Login */}
          <div className="card-footer-text">
            <span>Already registered?</span>
            <button
              type="button"
              className="link-button"
              onClick={() => onNavigateToLogin?.(formData.email)}
            >
              Sign in here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
