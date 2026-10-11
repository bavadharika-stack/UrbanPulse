import React, { useState } from 'react';
import { Button } from './ui';

export default function ReportPhotos({ report }) {
  const [mobilePhoto, setMobilePhoto] = useState('before');
  if (!report?.imageUrl) return null;

  const hasAfterPhoto = Boolean(report.afterImageUrl);
  const photo = (label, url) => (
    <figure className={`report-photo report-photo-${label.toLowerCase()}`} key={label}>
      <img src={url} alt={`${label} photo for ${report.title}`} />
      <figcaption>{label}</figcaption>
    </figure>
  );

  return (
    <section className="report-photo-comparison" aria-label="Report photo comparison">
      {hasAfterPhoto && (
        <div className="report-photo-mobile-toggle">
          <Button
            variant={mobilePhoto === 'before' ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={mobilePhoto === 'before'}
            onClick={() => setMobilePhoto('before')}
          >
            Before
          </Button>
          <Button
            variant={mobilePhoto === 'after' ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={mobilePhoto === 'after'}
            onClick={() => setMobilePhoto('after')}
          >
            After
          </Button>
        </div>
      )}
      <div className={`report-photo-pair show-${mobilePhoto}`}>
        {photo('Before', report.imageUrl)}
        {hasAfterPhoto
          ? photo('After', report.afterImageUrl)
          : <p className="report-photo-pending">No after photo has been added yet.</p>}
      </div>
    </section>
  );
}
