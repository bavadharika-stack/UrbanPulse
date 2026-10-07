import React, { useState, useEffect } from 'react';
import Header from './shared/Header';
import Footer from './shared/Footer';
import Registration from './modules/registration/Registration';
import Login from './modules/login/Login';
import Dashboard from './modules/dashboard/Dashboard';
import NgoDashboard from './modules/dashboard/NgoDashboard';
import ImageUpload from './modules/image-upload/ImageUpload';
import { getCurrentUser, logoutUser } from './shared/authStorage';

export default function App() {
  const [currentView, setCurrentView] = useState('login'); // 'login' | 'register' | 'dashboard' | 'ngo-dashboard' | 'image-upload'
  const [currentUser, setCurrentUser] = useState(null);
  const [prefilledEmail, setPrefilledEmail] = useState('');

  // Check if a user session is already saved in localStorage
  useEffect(() => {
    const savedUser = getCurrentUser();
    if (savedUser) {
      setCurrentUser(savedUser);
      setCurrentView(savedUser.role === 'ngo' ? 'ngo-dashboard' : 'dashboard');
    }
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
    setCurrentView(user?.role === 'ngo' ? 'ngo-dashboard' : 'dashboard');
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setCurrentView('login');
  };

  const handleNavClick = (view) => {
    if ((view === 'dashboard' || view === 'image-upload') && !currentUser) {
      setCurrentView('login');
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

        {currentView === 'dashboard' && (
          <Dashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onStartReport={() => setCurrentView('image-upload')}
          />
        )}

        {currentView === 'image-upload' && (
          <ImageUpload
            onBackToDashboard={() => setCurrentView('dashboard')}
          />
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
