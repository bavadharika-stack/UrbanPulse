import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { authenticateUser } from '../../shared/authStorage';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login({ initialEmail = '', onLoginSuccess, onNavigateToRegister }) {
  const [formData, setFormData] = useState({
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
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (authError) setAuthError('');

    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = (e) => {
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

    // Authenticate with local storage demo
    setTimeout(() => {
      const result = authenticateUser(formData.email, formData.password);

      if (!result.success) {
        setAuthError(result.message || 'Invalid email or password.');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onLoginSuccess?.(result.user);
    }, 300);
  };

  return (
    <div className="auth-page-container">
      <div className="card" id="login-card">
        <div className="card-header">
          <h2 className="card-title">Sign In to UrbanPulse</h2>
          <p className="card-subtitle">
            Access the citizen reporting portal to submit and manage public space feedback.
          </p>
        </div>

        {authError && (
          <div className="alert alert-error" role="alert" id="login-error-alert">
            <AlertCircle size={18} className="alert-icon" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email Address <span className="text-danger">*</span>
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
                placeholder="e.g. demo@urbanpulse.com"
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
              Password <span className="text-danger">*</span>
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
                placeholder="Enter your password"
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
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Quick Demo Credentials Tip */}
          <div className="demo-credentials-card">
            <strong>Demo account:</strong> <code>demo@urbanpulse.com</code> / <code>Password123</code>
          </div>

          {/* Link to Register */}
          <div className="card-footer-text">
            <span>Don't have an account yet?</span>
            <button
              type="button"
              id="link-goto-register"
              className="link-button"
              onClick={onNavigateToRegister}
            >
              Create an account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
