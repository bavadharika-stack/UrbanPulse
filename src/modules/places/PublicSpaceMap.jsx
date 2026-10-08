import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { AlertCircle, MapPin, RefreshCw } from 'lucide-react';
import { getLocationScores } from '../../api';

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

export default function PublicSpaceMap() {
  const [scores, setScores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadScores = async () => {
    setIsLoading(true);
    setError('');
    try {
      setScores(await getLocationScores());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadScores(); }, []);

  const mappableScores = useMemo(
    () => scores.filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)),
    [scores],
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
          <span><i className="legend-dot" style={{ background: BAND_COLORS.red }} /> Below 50</span>
          <span><i className="legend-dot" style={{ background: BAND_COLORS.yellow }} /> 50–74</span>
          <span><i className="legend-dot" style={{ background: BAND_COLORS.green }} /> 75 and above</span>
        </div>

        {error && (
          <div className="alert alert-error mt-3" role="alert">
            <AlertCircle size={18} className="alert-icon" /><span>{error}</span>
          </div>
        )}
        {isLoading ? (
          <p className="card-subtitle map-loading">Loading place scores…</p>
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
            {mappableScores.map((place) => (
              <Marker
                key={place.id}
                position={[place.latitude, place.longitude]}
                icon={placeIcon(place.colorBand)}
                title={place.name}
              >
                <Popup>
                  <strong>{place.name}</strong>
                  {place.isUserAdded === 1 && (
                    <span className="citizen-added-label map-citizen-label">Added by a citizen</span>
                  )}
                  <div className="map-popup-scores">
                    {SCORE_FIELDS.map(([key, label]) => (
                      <div key={key}><span>{label}</span><strong>{scoreText(place.scores[key])}</strong></div>
                    ))}
                  </div>
                  <p className="map-popup-overall">
                    Overall: <strong>{scoreText(place.scores.overall)}</strong>
                    {' · '}{place.ratingCount} rating{place.ratingCount === 1 ? '' : 's'}
                  </p>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <p className="card-subtitle map-loading"><MapPin size={16} /> No mapped locations are available.</p>
        )}
      </div>
    </div>
  );
}
