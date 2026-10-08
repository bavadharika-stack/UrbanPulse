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
import { getCurrentUser, logoutUser } from './api';

export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [prefilledEmail, setPrefilledEmail] = useState('');
  const [sessionError, setSessionError] = useState('');

  const getHomeView = (user) => {
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
    if (['dashboard', 'image-upload', 'rate-place', 'map'].includes(view) && !currentUser) {
      setCurrentView('login');
      return;
    }
    if (currentUser?.role === 'authority' && (view === 'dashboard' || view === 'image-upload')) {
      setCurrentView('authority-dashboard');
      return;
    }
    if (currentUser?.role === 'ngo' && view === 'dashboard') {
      setCurrentView('ngo-dashboard');
      return;
    }
    if (['image-upload', 'rate-place', 'map'].includes(view) && currentUser?.role !== 'citizen') {
      setCurrentView(getHomeView(currentUser));
      return;
    }
    setCurrentView(view);
  };

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <Header
        currentView={currentView}
        currentUser={currentUser}
        onNavigate={handleNavClick}
        onLogout={handleLogout}
      />

      {/* Main Page Body */}
      <main className="main-wrapper">
        <div style={{ width: '100%' }}>
          {sessionError && (
            <div className="alert alert-error" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span>{sessionError}</span>
            </div>
          )}

          {currentView === 'register' && (
            <Registration onNavigateToLogin={handleNavigateToLogin} />
          )}

          {currentView === 'login' && (
            <Login
              initialEmail={prefilledEmail}
              onLoginSuccess={handleLoginSuccess}
              onNavigateToRegister={handleNavigateToRegister}
            />
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

          {currentView === 'dashboard' && (
            <Dashboard
              currentUser={currentUser}
              onLogout={handleLogout}
              onStartReport={() => setCurrentView('image-upload')}
              onOpenMap={() => setCurrentView('map')}
              onRatePlace={() => setCurrentView('rate-place')}
            />
          )}

          {currentView === 'image-upload' && (
            <ImageUpload
              onBackToDashboard={() => setCurrentView('dashboard')}
            />
          )}

          {currentView === 'rate-place' && currentUser?.role === 'citizen' && (
            <RatePlace onBack={() => setCurrentView('dashboard')} />
          )}

          {currentView === 'map' && currentUser?.role === 'citizen' && (
            <PublicSpaceMap />
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
