import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { loginAccount } from '../../api';
import { useI18n } from '../../i18n/I18nProvider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login({ initialEmail = '', onLoginSuccess, onNavigateToRegister }) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    role: 'citizen',
    email: initialEmail || '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Field-level validation
  const validateField = (name, value) => {
    let error = '';
    if (name === 'email') {
      if (!value.trim()) {
        error = 'Email address is required.';
      } else if (!EMAIL_REGEX.test(value.trim())) {
        error = 'Please enter a valid email address.';
      }
    } else if (name === 'password') {
      if (!value) {
        error = 'Password is required.';
      }
    }
    return error ? t(error) : error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (authError) setAuthError('');

    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    const newErrors = {
      email: validateField('email', formData.email),
      password: validateField('password', formData.password),
    };

    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((err) => Boolean(err));
    if (hasErrors) return;

    setIsLoading(true);
    try {
      const result = await loginAccount({
        role: formData.role,
        email: formData.email,
        password: formData.password,
      });
      onLoginSuccess?.(result.user);
    } catch (error) {
      setAuthError(error.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="card" id="login-card">
        <div className="card-header">
          <h2 className="card-title">{t('Sign In to UrbanPulse')}</h2>
          <p className="card-subtitle">
              {t('Choose your portal and sign in with the account created for that role.')}
          </p>
        </div>

        {authError && (
          <div className="alert alert-error" role="alert" id="login-error-alert">
            <AlertCircle size={18} className="alert-icon" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-role" className="form-label">{t('Portal')}</label>
            <select
              id="login-role"
              name="role"
              className="form-control input-no-prefix"
              value={formData.role}
              onChange={handleChange}
              disabled={isLoading}
            >
              <option value="citizen">{t('Citizen')}</option>
              <option value="ngo">{t('NGO')}</option>
              <option value="authority">{t('Authority')}</option>
              <option value="admin">{t('Admin')}</option>
            </select>
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              {t('Email Address')} <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <span className="input-prefix">
                <Mail size={17} />
              </span>
              <input
                id="login-email"
                name="email"
                type="email"
                className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                placeholder={t('e.g. demo@urbanpulse.com')}
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
            <label htmlFor="login-password" className="form-label">
              {t('Password')} <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <span className="input-prefix">
                <Lock size={17} />
              </span>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                placeholder={t('Enter your password')}
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="input-suffix-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={t(showPassword ? 'Hide password' : 'Show password')}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <div className="form-feedback">{errors.password}</div>}
          </div>

          {/* Submit Button */}
          <button
            id="btn-login-submit"
            type="submit"
            className="btn btn-primary btn-block mt-3"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border"></span>
                <span>{t('Signing in...')}</span>
              </>
            ) : (
              <>
                <span>{t('Sign In')}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Quick Demo Credentials Tip */}
          <div className="demo-credentials-card">
            <strong>{t('Separate accounts:')}</strong> {t('Choose the portal matching your account.')}
            {formData.role === 'authority' && ' Demo Authority uses authority@urbanpulse.com and the server DEMO_AUTHORITY_PASSWORD; SEED_DEMO_ACCOUNTS must be enabled.'}
            {formData.role === 'admin' && ' Admin uses ADMIN_EMAIL (default admin@urbanpulse.com) and DEMO_ADMIN_PASSWORD; admin seeding also requires SEED_DEMO_DATA=true.'}
          </div>

          {/* Link to Register */}
          <div className="card-footer-text">
            <span>{t("Don't have an account yet?")}</span>
            <button
              type="button"
              id="link-goto-register"
              className="link-button"
              onClick={onNavigateToRegister}
            >
              {t('Create an account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
