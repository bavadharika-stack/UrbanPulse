import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { AlertCircle, ArrowLeft, CheckCircle2, MapPin, Search } from 'lucide-react';
import { createPlace, getLocations, searchPlaces, submitPlaceRating } from '../../api';
import useUrlFilters from '../../shared/useUrlFilters';
import { Badge, Card, FormField, useToast } from '../../shared/ui';

const DEFAULT_PLACE_FILTER = { place: '' };

const REQUIRED_FIELDS = [
  ['cleanliness', 'Cleanliness'],
  ['safety', 'Safety'],
  ['lighting', 'Lighting'],
  ['accessibility', 'Accessibility'],
  ['seating', 'Seating'],
];
const OPTIONAL_FIELDS = [['shade', 'Shade'], ['waterAvailability', 'Water availability']];
const EMPTY_RATING = {
  cleanliness: 0,
  safety: 0,
  lighting: 0,
  accessibility: 0,
  seating: 0,
  shade: null,
  waterAvailability: null,
};
const ADD_PLACE_OPTION = '__add_place__';
const CHENNAI_CENTER = [13.0475, 80.2209];
const draftPlaceIcon = L.divIcon({
  className: 'place-marker-wrapper',
  html: '<span class="place-marker" style="background:#0284c7"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function PinDropper({ position, onChange }) {
  const map = useMap();
  useMapEvents({
    click(event) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  useEffect(() => {
    if (position) map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 15));
  }, [map, position]);
  return position ? (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={draftPlaceIcon}
      draggable
      title="New place location"
      eventHandlers={{
        dragend(event) {
          const point = event.target.getLatLng();
          onChange({ latitude: point.lat, longitude: point.lng });
        },
      }}
    />
  ) : null;
}

function StarRating({ name, label, value, onChange, optional = false }) {
  return (
    <fieldset className="rating-field">
      <legend className="form-label">{label}{!optional && <span className="text-danger"> *</span>}</legend>
      <div className="rating-stars" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} out of 5`}
            tabIndex={value === star || (!value && star === 1) ? 0 : -1}
            className={`rating-star${value >= star ? ' selected' : ''}`}
            onClick={() => onChange(name, star)}
            onKeyDown={(event) => {
              if (['ArrowRight', 'ArrowUp'].includes(event.key)) {
                event.preventDefault();
                const next = star === 5 ? 1 : star + 1;
                onChange(name, next);
                event.currentTarget.parentElement.querySelector(`[aria-label="${next} out of 5"]`)?.focus();
              } else if (['ArrowLeft', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                const next = star === 1 ? 5 : star - 1;
                onChange(name, next);
                event.currentTarget.parentElement.querySelector(`[aria-label="${next} out of 5"]`)?.focus();
              }
            }}
          >
            ★
          </button>
        ))}
        <span className="rating-value">{value ? `${value}/5` : 'Not rated'}</span>
      </div>
      {optional && value !== null && (
        <button type="button" className="link-button rating-clear" onClick={() => onChange(name, null)}>
          Clear optional rating
        </button>
      )}
    </fieldset>
  );
}

export default function RatePlace({ onBack, onReportIssue }) {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState('');
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pin, setPin] = useState({ latitude: CHENNAI_CENTER[0], longitude: CHENNAI_CENTER[1] });
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingPlace, setIsSavingPlace] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [ratings, setRatings] = useState(EMPTY_RATING);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lowRatingPlace, setLowRatingPlace] = useState('');
  const [placeFilters, setPlaceFilters] = useUrlFilters(DEFAULT_PLACE_FILTER);
  const notify = useToast();
  const visibleLocations = locations.filter((place) => (
    !placeFilters.place
    || `${place.name} ${place.address || ''}`.toLowerCase().includes(placeFilters.place.toLowerCase())
  ));

  useEffect(() => {
    let active = true;
    getLocations()
      .then((result) => {
        if (active) setLocations(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isAddingPlace || placeQuery.trim().length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError('');
      return undefined;
    }
    let active = true;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setSearchError('');
      try {
        const results = await searchPlaces(placeQuery.trim());
        if (active) setSearchResults(results);
      } catch (searchFailure) {
        if (active) setSearchError(searchFailure.message);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 650);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [isAddingPlace, placeQuery]);

  const updateRating = (field, value) => {
    setRatings((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLowRatingPlace('');
    if (isAddingPlace) return;
    if (!locationId) {
      setError('Choose a place to rate.');
      return;
    }
    const missingField = REQUIRED_FIELDS.find(([field]) => !ratings[field]);
    if (missingField) {
      setError(`Add a rating for ${missingField[1]}.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await submitPlaceRating({
        locationId: Number(locationId),
        ...ratings,
        comment: comment.trim(),
      });
      setSuccess('Thanks — your place rating has been submitted.');
      const lowScore = Object.values(ratings).some((value) => value !== null && value <= 2);
      if (lowScore) {
        setLowRatingPlace(locations.find((place) => String(place.id) === locationId)?.name || '');
      }
      notify('Your place rating has been submitted.');
      setRatings(EMPTY_RATING);
      setComment('');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaceSelect = (value) => {
    setError('');
    setSuccess('');
    setLowRatingPlace('');
    if (value === ADD_PLACE_OPTION) {
      setLocationId(ADD_PLACE_OPTION);
      setIsAddingPlace(true);
      setPlaceName('');
      setPlaceAddress('');
      setPlaceQuery('');
      setPin({ latitude: CHENNAI_CENTER[0], longitude: CHENNAI_CENTER[1] });
      return;
    }
    setIsAddingPlace(false);
    setLocationId(value);
  };

  const chooseSearchResult = (result) => {
    setPlaceName(result.name);
    setPlaceAddress(result.address);
    setPin({ latitude: result.latitude, longitude: result.longitude });
    setSearchResults([]);
    setPlaceQuery('');
  };

  const handleSavePlace = async () => {
    setError('');
    if (placeName.trim().length < 3 || placeName.trim().length > 120) {
      setError('Place name must be between 3 and 120 characters.');
      return;
    }
    setIsSavingPlace(true);
    try {
      const result = await createPlace({
        name: placeName.trim(),
        latitude: pin.latitude,
        longitude: pin.longitude,
        address: placeAddress,
      });
      const savedPlace = result.location;
      setLocations((current) => (
        current.some((place) => place.id === savedPlace.id)
          ? current
          : [...current, savedPlace].sort((left, right) => left.name.localeCompare(right.name))
      ));
      setLocationId(String(savedPlace.id));
      setIsAddingPlace(false);
      setSuccess(result.created ? 'Place added. Now rate it below.' : 'An existing nearby place was selected. Rate it below.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingPlace(false);
    }
  };

  return (
    <div className="dashboard-container place-page">
      <div className="card dashboard-welcome-card">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={15} /><span>Back</span>
        </button>
        <div>
          <div className="user-role-tag">Citizen Contributor</div>
          <h2 className="dashboard-title">Rate a Place</h2>
          <p className="dashboard-subtitle">Share how this public space works for your community.</p>
        </div>
      </div>

      <Card as="form" className="mt-3" onSubmit={handleSubmit}>
        <FormField label="Search places" htmlFor="rating-place-search">
          <input id="rating-place-search" type="search" className="form-control input-no-prefix"
            value={placeFilters.place} maxLength={120} placeholder="Find a place by name or address"
            onChange={(event) => setPlaceFilters({ place: event.target.value })} />
        </FormField>
        <div className="form-group">
          <label className="form-label" htmlFor="rating-location">
            <MapPin size={14} /> Place <span className="text-danger">*</span>
          </label>
          <select
            id="rating-location"
            className="form-control input-no-prefix"
            value={locationId}
            onChange={(event) => handlePlaceSelect(event.target.value)}
            disabled={isLoading || isSubmitting}
            required
          >
            <option value="">{isLoading ? 'Loading places…' : 'Choose a Chennai place'}</option>
            {visibleLocations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
            <option value={ADD_PLACE_OPTION}>Can’t find your place? Add it</option>
          </select>
        </div>

        {isAddingPlace && (
          <section className="add-place-panel" aria-labelledby="add-place-heading">
            <h3 id="add-place-heading" className="card-title">Add a public place</h3>
            <p className="card-subtitle">Search for a place, or click the map to drop a pin and drag it to the exact spot.</p>

            <div className="form-group mt-2">
              <label className="form-label" htmlFor="place-search">Search OpenStreetMap</label>
              <div className="input-group">
                <span className="input-prefix"><Search size={16} /></span>
                <input
                  id="place-search"
                  type="search"
                  className="form-control"
                  value={placeQuery}
                  onChange={(event) => setPlaceQuery(event.target.value)}
                  placeholder="Search a place in India"
                  maxLength={120}
                  disabled={isSavingPlace}
                />
              </div>
              <span className="card-subtitle">Search waits briefly after typing. Results are provided by OpenStreetMap.</span>
            </div>

            {isSearching && <p className="card-subtitle" role="status">Searching places…</p>}
            {searchError && <div className="alert alert-error mt-2" role="alert"><AlertCircle size={16} />{searchError}</div>}
            {searchResults.length > 0 && (
              <ul className="geocode-results" aria-label="Place search results">
                {searchResults.map((result, index) => (
                  <li key={`${result.latitude}-${result.longitude}-${index}`}>
                    <button type="button" onClick={() => chooseSearchResult(result)}>
                      <strong>{result.name}</strong><span>{result.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!isSearching && placeQuery.trim().length >= 3 && !searchError && searchResults.length === 0 && (
              <p className="card-subtitle">No search matches. You can place the pin on the map instead.</p>
            )}

            <div className="form-group mt-2">
              <label className="form-label" htmlFor="new-place-name">Place name</label>
              <input
                id="new-place-name"
                type="text"
                className="form-control input-no-prefix"
                value={placeName}
                onChange={(event) => setPlaceName(event.target.value)}
                placeholder="Enter a clear public place name"
                minLength={3}
                maxLength={120}
                disabled={isSavingPlace}
              />
            </div>

            <MapContainer center={CHENNAI_CENTER} zoom={12} className="place-picker-map" scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <PinDropper position={pin} onChange={setPin} />
            </MapContainer>
            <p className="place-coordinates" aria-live="polite">
              Selected coordinates: {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
            </p>
            <button
              type="button"
              className="btn btn-primary mt-2"
              onClick={handleSavePlace}
              disabled={isSavingPlace}
            >
              {isSavingPlace ? 'Saving place…' : 'Save Place and Continue'}
            </button>
          </section>
        )}

        {!isAddingPlace && locationId && locations.find((place) => String(place.id) === locationId)?.isUserAdded === 1 && (
          <Badge tone="status" className="citizen-added-label mt-2">Added by a citizen</Badge>
        )}

        {!isAddingPlace && locationId && (
        <div className="rating-grid">
          {REQUIRED_FIELDS.map(([field, label]) => (
            <StarRating
              key={field}
              name={field}
              label={label}
              value={ratings[field]}
              onChange={updateRating}
            />
          ))}
          {OPTIONAL_FIELDS.map(([field, label]) => (
            <StarRating
              key={field}
              name={field}
              label={label}
              value={ratings[field]}
              onChange={updateRating}
              optional
            />
          ))}
        </div>
        )}

        {!isAddingPlace && locationId && <FormField label="Comment (optional)" htmlFor="rating-comment" className="mt-3">
          <textarea
            id="rating-comment"
            className="form-control input-no-prefix"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Anything else people should know about this place?"
            disabled={isSubmitting}
          />
          <span className="card-subtitle">{comment.length}/1000</span>
        </FormField>}

        {error && (
          <div className="alert alert-error mt-2" role="alert">
            <AlertCircle size={18} className="alert-icon" /><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success mt-2" role="status">
            <CheckCircle2 size={18} /><span>{success}</span>
          </div>
        )}
        {lowRatingPlace && (
          <div className="alert alert-warning mt-2" role="status">
            <span>One or more ratings are 2 or lower. Is something specific broken?</span>
            <button type="button" className="link-button" onClick={() => onReportIssue?.(lowRatingPlace)}>
              Report an issue
            </button>
          </div>
        )}

        {!isAddingPlace && locationId && <button type="submit" className="btn btn-primary mt-3" disabled={isLoading || isSubmitting || !locations.length}>
          {isSubmitting ? 'Submitting…' : 'Submit Rating'}
        </button>}
        {!isAddingPlace && locationId && <p className="card-subtitle mt-2">You can submit one rating for each place per day.</p>}
      </Card>
    </div>
  );
}
