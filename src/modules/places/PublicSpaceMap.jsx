import React, { Suspense, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { getIssueDensity, getLocationScores } from '../../api';
import useUrlFilters from '../../shared/useUrlFilters';
import { Badge, EmptyState, FormField, Skeleton } from '../../shared/ui';

const DEFAULT_MAP_FILTERS = { place: '' };
const ScoreTrend = React.lazy(() => import('../../shared/ScoreTrend'));

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const BAND_COLORS = { red: '#dc2626', yellow: '#eab308', green: '#16a34a' };
const SCORE_FIELDS = [
  ['accessibility', 'Accessibility'],
  ['walkability', 'Walkability'],
  ['safety', 'Safety'],
  ['cleanliness', 'Cleanliness'],
  ['heatComfort', 'Heat comfort'],
];

const placeIcon = (band) => L.divIcon({
  className: 'place-marker-wrapper',
  html: `<span class="place-marker" style="background:${BAND_COLORS[band] || '#64748b'}"></span>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const scoreText = (value) => (value === null ? 'No score yet' : `${Math.round(value)}/100`);
const confidenceLabel = (place, key) => {
  const count = place.scoreCounts?.[key] ?? 0;
  return place.scores[key] === null
    ? 'No ratings'
    : `${scoreText(place.scores[key])}, based on ${count} rating${count === 1 ? '' : 's'}`;
};

function PlacePopup({ place }) {
  const [showTrend, setShowTrend] = useState(false);
  return (
    <>
      <strong>{place.name}</strong>
      <Badge tone={place.colorBand ? `score-${place.colorBand}` : 'neutral'} className="map-band-label">
        {place.colorBand ? `${place.colorBand[0].toUpperCase()}${place.colorBand.slice(1)} score band` : 'No score yet'}
      </Badge>
      {place.isUserAdded === 1 && (
        <span className="citizen-added-label map-citizen-label">Added by a citizen</span>
      )}
      <div className="map-popup-scores">
        {SCORE_FIELDS.map(([key, label]) => (
          <div key={key}>
            <span>{label}</span>
            <strong>{confidenceLabel(place, key)}</strong>
            {place.confidence?.[key] === 'low' && <Badge tone="score-yellow" className="rating-confidence">Low confidence</Badge>}
          </div>
        ))}
      </div>
      <p className="map-popup-overall">
        Overall: <strong>{confidenceLabel(place, 'overall')}</strong>
        {place.confidence?.overall === 'low' && <Badge tone="score-yellow" className="rating-confidence">Low confidence</Badge>}
      </p>
      <p className="map-popup-issues">{place.openReportCount} open issue{place.openReportCount === 1 ? '' : 's'} here</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTrend((open) => !open)}>
        {showTrend ? 'Hide trend' : 'View trend'}
      </button>
      {showTrend && (
        <Suspense fallback={<Skeleton lines={3} />}>
          <ScoreTrend locationId={place.id} locationName={place.name} />
        </Suspense>
      )}
    </>
  );
}

export default function PublicSpaceMap() {
  const [scores, setScores] = useState([]);
  const [densityPoints, setDensityPoints] = useState([]);
  const [layer, setLayer] = useState('markers');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useUrlFilters(DEFAULT_MAP_FILTERS);

  const loadScores = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [nextScores, nextDensity] = await Promise.all([getLocationScores(), getIssueDensity()]);
      setScores(nextScores);
      setDensityPoints(nextDensity);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadScores(); }, []);

  const mappableScores = useMemo(
    () => scores.filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
      && `${place.name} ${place.address || ''}`.toLowerCase().includes(filters.place.toLowerCase())),
    [scores, filters.place],
  );

  return (
    <div className="dashboard-container place-page map-page">
      <div className="card">
        <div className="map-heading">
          <div>
            <div className="user-role-tag">Chennai public spaces</div>
            <h2 className="dashboard-title">Place Scores Map</h2>
            <p className="dashboard-subtitle">Explore community ratings for accessibility, walkability, safety, cleanliness, and heat comfort.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadScores} disabled={isLoading}>
            <RefreshCw size={15} /><span>Refresh</span>
          </button>
        </div>

        <div className="map-legend" aria-label="Score color bands">
          <span><i className="legend-dot" style={{ background: BAND_COLORS.red }} /> Red · Below 50</span>
          <span><i className="legend-dot" style={{ background: BAND_COLORS.yellow }} /> Yellow · 50–74</span>
          <span><i className="legend-dot" style={{ background: BAND_COLORS.green }} /> Green · 75 and above</span>
        </div>
        <div className="map-layer-switch" role="group" aria-label="Map layer">
          <button type="button" className={`btn btn-sm ${layer === 'markers' ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={layer === 'markers'} onClick={() => setLayer('markers')}>Markers</button>
          <button type="button" className={`btn btn-sm ${layer === 'density' ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={layer === 'density'} onClick={() => setLayer('density')}>Problem density</button>
        </div>
        {layer === 'density' && (
          <div className="density-legend" aria-label="Problem density legend">
            <strong>Open issue density</strong>
            <span><i className="density-dot density-low" /> Low priority</span>
            <span><i className="density-dot density-high" /> Critical priority</span>
            <small>Verified issues receive extra weight; flagged reports are excluded.</small>
          </div>
        )}
        <FormField label="Search places" htmlFor="map-place-search" className="map-search">
          <input id="map-place-search" className="form-control input-no-prefix" type="search" maxLength={120}
            value={filters.place} placeholder="Search by place or address"
            onChange={(event) => setFilters({ place: event.target.value })} />
        </FormField>

        {error && (
          <div className="alert alert-error mt-3" role="alert">
            <AlertCircle size={18} className="alert-icon" /><span>{error}</span>
          </div>
        )}
        {isLoading ? (
          <Skeleton lines={4} className="map-loading" />
        ) : mappableScores.length ? (
          <MapContainer
            center={[13.0475, 80.2209]}
            zoom={11}
            scrollWheelZoom
            className="public-space-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {layer === 'markers' && mappableScores.map((place) => (
              <Marker
                key={place.id}
                position={[place.latitude, place.longitude]}
                icon={placeIcon(place.colorBand)}
                title={place.name}
              >
                <Popup>
                  <PlacePopup place={place} />
                </Popup>
              </Marker>
            ))}
            {layer === 'density' && densityPoints.map((point, index) => (
              <CircleMarker
                key={`${point.latitude}-${point.longitude}-${index}`}
                center={[point.latitude, point.longitude]}
                radius={8 + point.weight * 10}
                pathOptions={{
                  color: point.verified ? '#7f1d1d' : '#dc2626',
                  fillColor: point.verified ? '#b91c1c' : '#ef4444',
                  fillOpacity: 0.24 + Math.min(point.weight, 1) * 0.42,
                  weight: 2,
                }}
              >
                <Tooltip>
                  {point.priority} priority · {point.verified ? 'verified' : 'unverified'} open issue
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        ) : (
          <EmptyState title="No matching mapped places" description="Try another search term or clear the search." />
        )}
      </div>
    </div>
  );
}
