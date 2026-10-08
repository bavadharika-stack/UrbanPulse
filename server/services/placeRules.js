const { z } = require('zod');

const createPlaceSchema = z.object({
  name: z.string().trim().min(3).max(120),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  address: z.string().trim().max(300).optional(),
});

const EARTH_RADIUS_METERS = 6371000;
const DAILY_PLACE_LIMIT = 5;
const DUPLICATE_DISTANCE_METERS = 50;

const distanceMeters = (first, second) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const findDuplicatePlace = (candidate, locations) => locations.find((location) => (
  location.name.trim().toLocaleLowerCase() === candidate.name.trim().toLocaleLowerCase()
  || (
    Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && distanceMeters(candidate, location) <= DUPLICATE_DISTANCE_METERS
  )
)) || null;

const canAddPlaceToday = (count) => count < DAILY_PLACE_LIMIT;

module.exports = {
  canAddPlaceToday,
  createPlaceSchema,
  distanceMeters,
  findDuplicatePlace,
  DAILY_PLACE_LIMIT,
  DUPLICATE_DISTANCE_METERS,
};
