const API_TOKEN_KEY = 'urbanpulse_access_token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const LEGACY_STORAGE_KEYS = [
  'urbanpulse_registered_users',
  'urbanpulse_current_user',
  'urbanpulse_citizen_reports',
  'urbanpulse_ngo_availability',
];

const clearLegacyStorage = () => {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error('Could not clear legacy browser storage:', error);
  }
};
clearLegacyStorage();

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const request = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem(API_TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new ApiError('Could not reach the UrbanPulse API. Check that the backend is running.', 0);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new ApiError('The UrbanPulse API returned an invalid response.', response.status);
  }

  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(API_TOKEN_KEY);
    throw new ApiError(payload.message || 'The request could not be completed.', response.status, payload);
  }
  return payload;
};

export const registerAccount = (account) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(account),
  });

export const loginAccount = async (credentials) => {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  localStorage.setItem(API_TOKEN_KEY, result.token);
  return result;
};

export const getCurrentUser = async () => {
  if (!localStorage.getItem(API_TOKEN_KEY)) return null;
  const result = await request('/auth/me');
  return result.user;
};

export const logoutUser = () => {
  localStorage.removeItem(API_TOKEN_KEY);
};

export const createReport = async ({ location, title, category, description, image, submitAnyway = false }) => {
  const body = new FormData();
  body.append('location', location);
  body.append('title', title);
  body.append('category', category);
  body.append('description', description);
  body.append('image', image);
  if (submitAnyway) body.append('submitAnyway', 'true');
  return request('/reports', { method: 'POST', body });
};

const normalizeImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const apiOrigin = /^https?:\/\//i.test(API_BASE_URL)
    ? new URL(API_BASE_URL).origin
    : window.location.origin;
  return new URL(imageUrl, apiOrigin).toString();
};

const normalizeReport = (report) => ({
  ...report,
  imageUrl: normalizeImageUrl(report.imageUrl),
  afterImageUrl: normalizeImageUrl(report.afterImageUrl),
});

export const getReports = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') params.set(key, String(value));
  });
  const result = await request(`/reports${params.size ? `?${params.toString()}` : ''}`);
  return {
    ...result,
    reports: result.reports.map(normalizeReport),
  };
};

export const getLocations = async () => {
  const result = await request('/locations');
  return result.locations;
};

export const searchPlaces = async (query) => {
  const result = await request(`/geocode/search?q=${encodeURIComponent(query)}`);
  return result.results;
};

export const createPlace = async (place) => {
  const result = await request('/locations', {
    method: 'POST',
    body: JSON.stringify(place),
  });
  return result;
};

export const getPlacesForModeration = async () => {
  const result = await request('/locations/moderation');
  return result.locations;
};

export const updatePlaceStatus = async ({ locationId, status }) => {
  const result = await request(`/locations/${encodeURIComponent(locationId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return result.location;
};

export const submitPlaceRating = async (rating) => {
  const result = await request('/ratings', {
    method: 'POST',
    body: JSON.stringify(rating),
  });
  return result.rating;
};

export const getLocationScores = async () => {
  const result = await request('/scores');
  return result.scores;
};

export const getLocationScore = async (locationId) => {
  const result = await request(`/locations/${encodeURIComponent(locationId)}/scores`);
  return result.score;
};

export const getLocationHistory = async (locationId, days = 30) => {
  const result = await request(`/locations/${encodeURIComponent(locationId)}/history?days=${days}`);
  return result;
};

export const getIssueDensity = async () => {
  const result = await request('/locations/density');
  return result.points;
};

export const getImpactReport = async (filters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') params.set(key, String(value));
  });
  const result = await request(`/reports/impact?${params.toString()}`);
  const apiOrigin = /^https?:\/\//i.test(API_BASE_URL)
    ? new URL(API_BASE_URL).origin
    : window.location.origin;
  return {
    ...result.impact,
    resolvedGallery: result.impact.resolvedGallery.map((item) => ({
      ...item,
      imageUrl: normalizeImageUrl(item.beforeImageUrl),
      afterImageUrl: normalizeImageUrl(item.afterImageUrl),
    })),
    apiOrigin,
  };
};

export const downloadImpactPdf = async (filters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') params.set(key, String(value));
  });
  const headers = new Headers();
  const token = localStorage.getItem(API_TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}/reports/impact/pdf?${params.toString()}`, { headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.message || 'Could not download the impact report.', response.status, payload);
  }
  return response.blob();
};

export const getReport = async (reportId) => {
  const result = await request(`/reports/${encodeURIComponent(reportId)}`);
  return normalizeReport(result.report);
};

export const getReportHistory = async (reportId) => {
  const result = await request(`/reports/${encodeURIComponent(reportId)}/history`);
  return result.events;
};

export const confirmReport = async (reportId) => {
  const result = await request(`/reports/${encodeURIComponent(reportId)}/confirm`, { method: 'POST' });
  return result;
};

export const acceptReport = async (reportId) => {
  const result = await request(`/reports/${encodeURIComponent(reportId)}/accept`, {
    method: 'POST',
  });
  return normalizeReport(result.report);
};

export const updateReportStatus = async ({ reportId, status, note, afterImage }) => {
  const body = afterImage ? new FormData() : JSON.stringify({ status, note });
  if (afterImage) {
    body.append('status', status);
    if (note) body.append('note', note);
    body.append('afterImage', afterImage);
  }
  const result = await request(`/reports/${encodeURIComponent(reportId)}/status`, {
    method: 'PATCH',
    body,
  });
  return normalizeReport(result.report);
};

export const verifyReport = async (reportId) => {
  const result = await request(`/reports/${encodeURIComponent(reportId)}/verify`, {
    method: 'PATCH',
  });
  return normalizeReport(result.report);
};

export const getNgoAvailability = async () => {
  const result = await request('/ngo/availability');
  return result.status;
};

export const setNgoAvailability = async (status) => {
  const result = await request('/ngo/availability', {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return result.status;
};

export const getNotifications = async () => request('/notifications?page=1&pageSize=20');

export const markNotificationRead = async (notificationId) => {
  const result = await request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' });
  return result.unreadCount;
};

export const getAdminUsers = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const result = await request(`/admin/users${params.size ? `?${params}` : ''}`);
  return result.users;
};

export const updateAdminUserStatus = async ({ userId, status }) => {
  const result = await request(`/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return result.user;
};

export const getAdminLocations = async () => {
  const result = await request('/admin/locations');
  return result.locations;
};

export const getAuditLog = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/admin/audit${params.size ? `?${params}` : ''}`);
};

export const updateLocationStatus = async ({ locationId, status }) => {
  const result = await request(`/admin/locations/${encodeURIComponent(locationId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return result.location;
};

export const performAuthorityAction = async ({ reportId, action, ...body }) => {
  const paths = {
    assign: ['PATCH', 'department'],
    priority: ['PATCH', 'priority'],
    respond: ['POST', 'response'],
    resolve: ['POST', 'resolve'],
    flag: ['POST', 'flag-fake'],
  };
  const [method, path] = paths[action] || [];
  if (!method) throw new Error('Unknown report action.');
  const result = await request(`/reports/${encodeURIComponent(reportId)}/${path}`, {
    method,
    body: JSON.stringify(body),
  });
  return normalizeReport(result.report);
};
