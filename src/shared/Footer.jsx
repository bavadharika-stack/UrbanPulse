import React from 'react';
import { useI18n } from '../i18n/I18nProvider';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-brand">
          <img src="/brand/logo-emblem.png" alt="" aria-hidden="true" />
          <div>
            <strong>UrbanPulse</strong>
            <p>{t('Cleaner Cities, Brighter Lives')}</p>
          </div>
        </div>
        <nav className="footer-links" aria-label={t('Footer links')}>
          <a href="#main-content">{t('Back to top')}</a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t('Map data attribution')}</a>
        </nav>
      </div>
    </footer>
  );
}
