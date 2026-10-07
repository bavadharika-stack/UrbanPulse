const API_TOKEN_KEY = 'urbanpulse_access_token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const legacyDemoData = (() => {
  const data = { reports: null, ngoAvailability: {} };
  const legacyKeys = [
    'urbanpulse_registered_users',
    'urbanpulse_current_user',
    'urbanpulse_citizen_reports',
    'urbanpulse_ngo_availability',
  ];

  try {
    const savedReports = localStorage.getItem('urbanpulse_citizen_reports');
    if (savedReports) {
      const parsedReports = JSON.parse(savedReports);
      if (Array.isArray(parsedReports)) data.reports = parsedReports;
    }

    const savedAvailability = localStorage.getItem('urbanpulse_ngo_availability');
    if (savedAvailability) {
      const parsedAvailability = JSON.parse(savedAvailability);
      if (parsedAvailability && typeof parsedAvailability === 'object' && !Array.isArray(parsedAvailability)) {
        data.ngoAvailability = parsedAvailability;
      }
    }

    legacyKeys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error('Could not migrate legacy browser data:', error);
  }

  return data;
})();

export const getLegacyDemoData = () => legacyDemoData;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const request = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
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
    throw new ApiError(payload.message || 'The request could not be completed.', response.status);
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
