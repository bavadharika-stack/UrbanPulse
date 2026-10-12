import React from 'react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-brand">
          <img src="/brand/logo-emblem.png" alt="" aria-hidden="true" />
          <div>
            <strong>UrbanPulse</strong>
            <p>Cleaner Cities, Brighter Lives</p>
          </div>
        </div>
        <nav className="footer-links" aria-label="Footer links">
          <a href="#main-content">Back to top</a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Map data attribution</a>
        </nav>
      </div>
    </footer>
  );
}
