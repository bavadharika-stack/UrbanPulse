import React from 'react';
import {
  LogIn, UserPlus, LogOut, Menu, Moon, Sun, X, Bell, LayoutDashboard, Map, Star, ClipboardList,
} from 'lucide-react';
import { getNotifications, markNotificationRead } from '../api';

export default function Header({ currentView, currentUser, onNavigate, onLogout, theme, onToggleTheme }) {
  const portalNames = {
    citizen: 'Citizen Portal',
    ngo: 'NGO Portal',
    authority: 'Authority Portal',
    admin: 'Admin Portal',
  };
  const userInitials = (currentUser?.fullName || 'UrbanPulse')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  const roleLabels = { citizen: 'Citizen', ngo: 'NGO', authority: 'Authority', admin: 'Admin' };
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notificationError, setNotificationError] = React.useState('');
  const loadNotifications = React.useCallback(async () => {
    if (!currentUser) return;
    try {
      const result = await getNotifications();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setNotificationError('');
    } catch (error) {
      setNotificationError(error.message);
    }
  }, [currentUser]);
  React.useEffect(() => {
    loadNotifications();
    if (!currentUser) return undefined;
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [currentUser, loadNotifications]);
  const navigate = (view) => {
    onNavigate(view);
    setMenuOpen(false);
  };
  return (
    <header className="site-header" data-role={currentUser?.role || 'guest'}>
      <div className="header-container">
        {/* Brand Logo & Name */}
        <button type="button" className="brand brand-button" onClick={() => navigate(currentUser ? 'dashboard' : 'login')}>
          <img className="brand-icon-image" src="/brand/logo-emblem.png" alt="" aria-hidden="true" />
          <div className="brand-info">
            <span className="brand-name">UrbanPulse</span>
            <span className="brand-desc">{portalNames[currentUser?.role] || 'Civic Services Portal'}</span>
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
                    <LayoutDashboard size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    type="button"
                    className={`nav-btn ${currentView === 'map' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('map')}
                  >
                    <Map size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span>Map</span>
                  </button>
                  <button
                    type="button"
                    className={`nav-btn ${currentView === 'rate-place' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('rate-place')}
                  >
                    <Star size={17} strokeWidth={1.75} aria-hidden="true" />
                    <span>Rate a Place</span>
                  </button>
                </div>
              )}
              {currentUser.role === 'admin' && (
                <div className="nav-links">
                  <button type="button" className={`nav-btn ${currentView === 'admin-dashboard' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('admin-dashboard')}><LayoutDashboard size={17} strokeWidth={1.75} aria-hidden="true" /><span>Admin</span></button>
                  <button type="button" className={`nav-btn ${currentView === 'impact-report' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('impact-report')}><ClipboardList size={17} strokeWidth={1.75} aria-hidden="true" /><span>Impact Report</span></button>
                </div>
              )}
              {currentUser.role === 'ngo' && (
                <div className="nav-links">
                  <button type="button" className={`nav-btn ${currentView === 'ngo-dashboard' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('ngo-dashboard')}><LayoutDashboard size={17} strokeWidth={1.75} aria-hidden="true" /><span>Dashboard</span></button>
                  <button type="button" className={`nav-btn ${currentView === 'impact-report' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('impact-report')}><ClipboardList size={17} strokeWidth={1.75} aria-hidden="true" /><span>Impact Report</span></button>
                </div>
              )}
              {currentUser.role === 'authority' && (
                <div className="nav-links">
                  <button type="button" className={`nav-btn ${currentView === 'authority-dashboard' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('authority-dashboard')}><LayoutDashboard size={17} strokeWidth={1.75} aria-hidden="true" /><span>Dashboard</span></button>
                  <button type="button" className={`nav-btn ${currentView === 'impact-report' ? 'nav-btn-active' : ''}`}
                    onClick={() => navigate('impact-report')}><ClipboardList size={17} strokeWidth={1.75} aria-hidden="true" /><span>Impact Report</span></button>
                </div>
              )}
              <span className="user-badge">
                <span className="user-avatar" aria-hidden="true">{userInitials}</span>
                <span className="user-badge-copy">
                  <strong>{currentUser.fullName}</strong>
                  <small>{roleLabels[currentUser.role] || 'User'}</small>
                </span>
              </span>
              <button
                type="button"
                className="nav-btn nav-btn-outline"
                onClick={() => { onLogout(); setMenuOpen(false); }}
              >
                <LogOut size={17} strokeWidth={1.75} />
                <span>Sign Out</span>
              </button>
              <div className="notification-menu">
                <button
                  type="button"
                  className="icon-button notification-toggle"
                  aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                  aria-expanded={notificationsOpen}
                  onClick={() => { setNotificationsOpen((open) => !open); if (!notificationsOpen) loadNotifications(); }}
                >
                  <Bell size={19} strokeWidth={1.75} />
                  {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
                {notificationsOpen && (
                  <section className="notification-dropdown" aria-label="Notifications">
                    <div className="notification-heading">
                      <strong>Notifications</strong>
                      <button type="button" className="link-button" onClick={loadNotifications}>Refresh</button>
                    </div>
                    {notificationError && <p className="notification-error" role="alert">{notificationError}</p>}
                    {!notifications.length && !notificationError
                      ? <p className="card-subtitle">You’re all caught up.</p>
                      : notifications.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`notification-item${item.isRead ? '' : ' notification-unread'}`}
                          onClick={async () => {
                            if (!item.isRead) {
                              try {
                                setUnreadCount(await markNotificationRead(item.id));
                                setNotifications((items) => items.map((current) => current.id === item.id ? { ...current, isRead: 1 } : current));
                              } catch (error) {
                                setNotificationError(error.message);
                              }
                            }
                          }}
                        >
                          <strong>{item.title}</strong>
                          <span>{item.message}</span>
                          <time>{new Date(item.createdAt).toLocaleString()}</time>
                        </button>
                      ))}
                  </section>
                )}
              </div>
            </div>
          ) : (
            <div className="nav-links">
              <button
                type="button"
                className={`nav-btn ${currentView === 'login' ? 'nav-btn-active' : ''}`}
                onClick={() => navigate('login')}
              >
                <LogIn size={17} strokeWidth={1.75} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                className={`nav-btn ${currentView === 'register' ? 'nav-btn-active' : ''}`}
                onClick={() => navigate('register')}
              >
                <UserPlus size={17} strokeWidth={1.75} />
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
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'} theme</span>
          </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
