import React from 'react';
import { Accessibility, MapPinned, UsersRound } from 'lucide-react';

const BENEFITS = [
  [MapPinned, 'Report local issues and follow their progress'],
  [Accessibility, 'Help make public spaces work for everyone'],
  [UsersRound, 'Build safer, cleaner places together'],
];

export default function AuthLayout({ children }) {
  return (
    <section className="auth-layout" aria-label="UrbanPulse account">
      <aside className="auth-brand-panel">
        <img className="auth-full-logo" src="/brand/logo-full.png" alt="UrbanPulse" />
        <p className="auth-tagline">Cleaner Cities, Brighter Lives</p>
        <ul className="auth-benefits">
          {BENEFITS.map(([Icon, text]) => (
            <li key={text}>
              <span className="auth-benefit-icon"><Icon size={19} strokeWidth={1.75} aria-hidden="true" /></span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </aside>
      <div className="auth-form-panel">
        <img className="auth-mobile-emblem" src="/brand/logo-emblem.png" alt="" aria-hidden="true" />
        {children}
      </div>
    </section>
  );
}
