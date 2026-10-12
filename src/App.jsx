import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import Header from './shared/Header';
import Footer from './shared/Footer';
import Registration from './modules/registration/Registration';
import Login from './modules/login/Login';
import Dashboard from './modules/dashboard/Dashboard';
import NgoDashboard from './modules/dashboard/NgoDashboard';
import AuthorityDashboard from './modules/dashboard/AuthorityDashboard';
import ImageUpload from './modules/image-upload/ImageUpload';
import RatePlace from './modules/places/RatePlace';
import PublicSpaceMap from './modules/places/PublicSpaceMap';
import AdminDashboard from './modules/dashboard/AdminDashboard';
import ImpactReport from './modules/dashboard/ImpactReport';
import AuthLayout from './shared/AuthLayout';
import { getCurrentUser, logoutUser } from './api';
import { ToastProvider } from './shared/ui';

export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [prefilledEmail, setPrefilledEmail] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('urbanpulse_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [reportLocationPrefill, setReportLocationPrefill] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('urbanpulse_theme', theme);
    } catch {
      // The app remains usable when browser preference storage is unavailable.
    }
  }, [theme]);

  const getHomeView = (user) => {
    if (user?.role === 'admin') return 'admin-dashboard';
    if (user?.role === 'ngo') return 'ngo-dashboard';
    if (user?.role === 'authority') return 'authority-dashboard';
    return 'dashboard';
  };

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active || !user) return;
        setCurrentUser(user);
        setCurrentView(getHomeView(user));
      })
      .catch((error) => {
        if (active) setSessionError(error.message);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, []);

  const handleNavigateToLogin = (email = '') => {
    if (email && typeof email === 'string') {
      setPrefilledEmail(email);
    }
    setCurrentView('login');
  };

  const handleNavigateToRegister = () => {
    setCurrentView('register');
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setCurrentView(getHomeView(user));
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setSessionError('');
    setCurrentView('login');
  };

  const handleNavClick = (view) => {
    if (['dashboard', 'image-upload', 'rate-place', 'map', 'impact-report'].includes(view) && !currentUser) {
      setCurrentView('login');
      return;
    }
    if (currentUser?.role === 'authority' && (view === 'dashboard' || view === 'image-upload')) {
      setCurrentView('authority-dashboard');
      return;
    }
    if (currentUser?.role === 'admin' && view === 'dashboard') {
      setCurrentView('admin-dashboard');
      return;
    }
    if (currentUser?.role === 'ngo' && view === 'dashboard') {
      setCurrentView('ngo-dashboard');
      return;
    }
    if (view === 'impact-report' && !['ngo', 'authority', 'admin'].includes(currentUser?.role)) {
      setCurrentView(getHomeView(currentUser));
      return;
    }
    if (['image-upload', 'rate-place', 'map'].includes(view) && currentUser?.role !== 'citizen') {
      setCurrentView(getHomeView(currentUser));
      return;
    }
    setCurrentView(view);
  };

  return (
    <ToastProvider>
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <Header
        currentView={currentView}
        currentUser={currentUser}
        onNavigate={handleNavClick}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      />

      {/* Main Page Body */}
      <main className="main-wrapper" id="main-content" data-role={currentUser?.role || 'guest'} data-view={currentView}>
        <div style={{ width: '100%' }}>
          {checkingSession && (
            <div className="app-loading" role="status" aria-label="Loading UrbanPulse">
              <img src="/brand/logo-emblem.png" alt="" />
              <span>Loading UrbanPulse</span>
            </div>
          )}
          {!checkingSession && (
            <>
          {sessionError && (
            <div className="alert alert-error" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span>{sessionError}</span>
            </div>
          )}

          {currentView === 'register' && (
            <AuthLayout><Registration onNavigateToLogin={handleNavigateToLogin} /></AuthLayout>
          )}

          {currentView === 'login' && (
            <AuthLayout>
              <Login
                initialEmail={prefilledEmail}
                onLoginSuccess={handleLoginSuccess}
                onNavigateToRegister={handleNavigateToRegister}
              />
            </AuthLayout>
          )}

          {currentView === 'ngo-dashboard' && (
            <NgoDashboard
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          )}

          {currentView === 'authority-dashboard' && (
            <AuthorityDashboard currentUser={currentUser} onLogout={handleLogout} />
          )}
          {currentView === 'admin-dashboard' && currentUser?.role === 'admin' && (
            <AdminDashboard currentUser={currentUser} />
          )}
          {currentView === 'impact-report' && ['ngo', 'authority', 'admin'].includes(currentUser?.role) && (
            <ImpactReport currentUser={currentUser} />
          )}

          {currentView === 'dashboard' && (
            <Dashboard
              currentUser={currentUser}
              onLogout={handleLogout}
              onStartReport={(location = '') => {
                setReportLocationPrefill(location);
                setCurrentView('image-upload');
              }}
              onOpenMap={() => setCurrentView('map')}
              onRatePlace={() => setCurrentView('rate-place')}
            />
          )}

          {currentView === 'image-upload' && (
            <ImageUpload
              currentUser={currentUser}
              onBackToDashboard={() => setCurrentView('dashboard')}
              initialLocation={reportLocationPrefill}
            />
          )}

          {currentView === 'rate-place' && currentUser?.role === 'citizen' && (
            <RatePlace
              onBack={() => setCurrentView('dashboard')}
              onReportIssue={(location) => {
                setReportLocationPrefill(location);
                setCurrentView('image-upload');
              }}
            />
          )}

          {currentView === 'map' && currentUser?.role === 'citizen' && (
            <PublicSpaceMap />
          )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
    </ToastProvider>
  );
}
