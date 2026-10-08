import React from 'react';
import { Activity, LogIn, UserPlus, LogOut, User } from 'lucide-react';

export default function Header({ currentView, currentUser, onNavigate, onLogout }) {
  return (
    <header className="site-header">
      <div className="header-container">
        {/* Brand Logo & Name */}
        <div className="brand" onClick={() => onNavigate(currentUser ? 'dashboard' : 'login')}>
          <div className="brand-icon">
            <Activity size={20} />
          </div>
          <div className="brand-info">
            <span className="brand-name">UrbanPulse</span>
            <span className="brand-desc">Citizen Portal</span>
          </div>
        </div>

        {/* Navigation Actions */}
        <nav className="header-nav">
          {currentUser ? (
            <div className="user-menu">
              {currentUser.role === 'citizen' && (
                <div className="nav-links">
                  <button
                    type="button"
                    className={`nav-btn ${currentView === 'dashboard' ? 'nav-btn-active' : ''}`}
                    onClick={() => onNavigate('dashboard')}
                  >
                    <span>Dashboard</span>
                  </button>
                  <button
                    type="button"
                    className={`nav-btn ${currentView === 'map' ? 'nav-btn-active' : ''}`}
                    onClick={() => onNavigate('map')}
                  >
                    <span>Map</span>
                  </button>
                  <button
                    type="button"
                    className={`nav-btn ${currentView === 'rate-place' ? 'nav-btn-active' : ''}`}
                    onClick={() => onNavigate('rate-place')}
                  >
                    <span>Rate a Place</span>
                  </button>
                </div>
              )}
              <span className="user-badge">
                <User size={14} />
                <span>{currentUser.fullName}</span>
              </span>
              <button
                type="button"
                className="nav-btn nav-btn-outline"
                onClick={onLogout}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="nav-links">
              <button
                type="button"
                className={`nav-btn ${currentView === 'login' ? 'nav-btn-active' : ''}`}
                onClick={() => onNavigate('login')}
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                className={`nav-btn ${currentView === 'register' ? 'nav-btn-active' : ''}`}
                onClick={() => onNavigate('register')}
              >
                <UserPlus size={14} />
                <span>Register</span>
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
