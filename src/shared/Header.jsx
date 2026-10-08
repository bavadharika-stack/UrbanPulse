import React from 'react';
import { Activity, LogIn, UserPlus, LogOut, User, Menu, Moon, Sun, X } from 'lucide-react';

export default function Header({ currentView, currentUser, onNavigate, onLogout, theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const navigate = (view) => {
    onNavigate(view);
    setMenuOpen(false);
  };
  return (
    <header className="site-header">
      <div className="header-container">
        {/* Brand Logo & Name */}
        <button type="button" className="brand brand-button" onClick={() => navigate(currentUser ? 'dashboard' : 'login')}>
          <div className="brand-icon">
            <Activity size={20} />
          </div>
          <div className="brand-info">
            <span className="brand-name">UrbanPulse</span>
            <span className="brand-desc">Citizen Portal</span>
          </div>
        </button>

        {/* Navigation Actions */}
        <nav className="header-nav">
          <button
            type="button"
            className="icon-button mobile-menu-toggle"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div id="primary-navigation" className={`header-menu${menuOpen ? ' header-menu-open' : ''}`}>
          {currentUser ? (
            <div className="user-menu">
              {currentUser.role === 'citizen' && (
                <div className="nav-links">
                  <button
                    type="button"
                    className={`nav-btn ${currentView === 'dashboard' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('dashboard')}
                  >
                    <span>Dashboard</span>
                  </button>
                  <button
                    type="button"
                    className={`nav-btn ${currentView === 'map' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('map')}
                  >
                    <span>Map</span>
                  </button>
                  <button
                    type="button"
                    className={`nav-btn ${currentView === 'rate-place' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('rate-place')}
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
                onClick={() => { onLogout(); setMenuOpen(false); }}
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
                onClick={() => navigate('login')}
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                className={`nav-btn ${currentView === 'register' ? 'nav-btn-active' : ''}`}
                onClick={() => navigate('register')}
              >
                <UserPlus size={14} />
                <span>Register</span>
              </button>
            </div>
          )}
          <button
            type="button"
            className="nav-btn theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'} theme</span>
          </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
