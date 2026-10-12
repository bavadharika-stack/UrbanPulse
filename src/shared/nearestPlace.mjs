const EARTH_RADIUS_METRES = 6_371_000;

export const distanceMetres = (first, second) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(Math.min(1, haversine)));
};

export const findNearestPlace = (point, places, maximumDistanceMetres = Infinity) => {
  if (!point || !Array.isArray(places)) return null;
  let nearest = null;
  for (const place of places) {
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const distance = distanceMetres(point, { latitude, longitude });
    if (distance <= maximumDistanceMetres && (!nearest || distance < nearest.distanceMetres)) {
      nearest = { place, distanceMetres: distance };
    }
  }
  return nearest;
};
