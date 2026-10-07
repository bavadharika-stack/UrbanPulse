// Storage keys for local demonstration
const USERS_KEY = 'urbanpulse_registered_users';
const SESSION_KEY = 'urbanpulse_current_user';
const REPORTS_KEY = 'urbanpulse_citizen_reports';
const NGO_AVAILABILITY_KEY = 'urbanpulse_ngo_availability';

// Built-in demo user for immediate testing
const DEFAULT_DEMO_USER = {
  id: 'demo-1',
  fullName: 'Demo Citizen',
  email: 'demo@urbanpulse.com',
  password: 'Password123',
  role: 'citizen',
  createdAt: new Date().toISOString(),
};

// Sample reports for demonstration
const DEFAULT_DEMO_REPORTS = [
  {
    id: 'rep-1',
    title: 'Damaged pathway',
    location: 'Anna Nagar, Chennai',
    category: 'Road & Infrastructure',
    description: 'The pathway near the park entrance is damaged and difficult for pedestrians to use.',
    status: 'Under Review',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    userEmail: 'demo@urbanpulse.com',
  },
  {
    id: 'rep-2',
    title: 'Overflowing waste bin',
    location: 'Mogappair, Chennai',
    category: 'Waste Management',
    description: 'Public waste bin overflowing near the bus stop causing hygiene issues.',
    status: 'Resolved',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    userEmail: 'demo@urbanpulse.com',
  },
  {
    id: 'rep-3',
    title: 'Broken streetlight',
    location: 'Ambattur, Chennai',
    category: 'Public Safety',
    description: 'Streetlight pole #14 is non-functional creating visibility issues.',
    status: 'Submitted',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    userEmail: 'demo@urbanpulse.com',
  },
];

/**
 * Initialize storage with demo account and demo reports if empty.
 * Also back-fills the category field on legacy demo reports.
 */
const initStorage = () => {
  try {
    const existingUsers = localStorage.getItem(USERS_KEY);
    if (!existingUsers) {
      localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_DEMO_USER]));
    }

    const existingReports = localStorage.getItem(REPORTS_KEY);
    if (!existingReports) {
      localStorage.setItem(REPORTS_KEY, JSON.stringify(DEFAULT_DEMO_REPORTS));
    } else {
      // Migrate: add category to known demo reports that were saved before this field existed
      const DEMO_CATEGORY_MAP = {
        'rep-1': 'Road & Infrastructure',
        'rep-2': 'Waste Management',
        'rep-3': 'Public Safety',
      };
      const reports = JSON.parse(existingReports);
      let changed = false;
      const migrated = reports.map((r) => {
        if (!r.category && DEMO_CATEGORY_MAP[r.id]) {
          changed = true;
          return { ...r, category: DEMO_CATEGORY_MAP[r.id] };
        }
        return r;
      });
      if (changed) {
        localStorage.setItem(REPORTS_KEY, JSON.stringify(migrated));
      }
    }
  } catch (e) {
    console.warn('localStorage not accessible:', e);
  }
};

initStorage();


/**
 * Get all registered users from localStorage
 */
export const getRegisteredUsers = () => {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [DEFAULT_DEMO_USER];
  } catch (e) {
    return [DEFAULT_DEMO_USER];
  }
};

/**
 * Save new registered user (Citizen or NGO)
 */
export const saveUser = ({ fullName, organizationName, email, password, role = 'citizen', ngoType }) => {
  const users = getRegisteredUsers();
  const normalizedEmail = email.trim().toLowerCase();

  const exists = users.some((u) => u.email.toLowerCase() === normalizedEmail);
  if (exists) {
    return {
      success: false,
      message: 'An account with this email address already exists.',
    };
  }

  const isNgo = role === 'ngo';
  const newUser = {
    id: isNgo ? `ngo-${Date.now()}` : `cit-${Date.now()}`,
    fullName: isNgo ? (organizationName?.trim() || '') : (fullName?.trim() || ''),
    ...(isNgo && {
      organizationName: organizationName?.trim() || '',
      ngoType: ngoType || '',
    }),
    email: normalizedEmail,
    password: password,
    role: isNgo ? 'ngo' : 'citizen',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save user:', e);
  }

  return {
    success: true,
    message: 'Registration successful! You can now log in.',
    user: newUser,
  };
};

/**
 * Authenticate login credentials
 */
export const authenticateUser = (email, password) => {
  const users = getRegisteredUsers();
  const normalizedEmail = email.trim().toLowerCase();

  const user = users.find(
    (u) => u.email.toLowerCase() === normalizedEmail && u.password === password
  );

  if (!user) {
    return {
      success: false,
      message: 'Invalid email or password.',
    };
  }

  // For NGO accounts, default availability to 'available' if not yet set
  if (user.role === 'ngo') {
    const stored = getNgoAvailability(user.id);
    if (stored === null) {
      setNgoAvailability(user.id, 'available');
    }
  }

  const sessionUser = {
    id: user.id,
    fullName: user.fullName || user.organizationName,
    organizationName: user.organizationName || '',
    email: user.email,
    role: user.role || 'citizen',
    ngoType: user.ngoType || '',
    availability: user.role === 'ngo' ? (getNgoAvailability(user.id) || 'available') : undefined,
    createdAt: user.createdAt,
  };

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  } catch (e) {
    console.error('Failed to set session:', e);
  }

  return {
    success: true,
    message: 'Login successful.',
    user: sessionUser,
  };
};

/**
 * Get active user session
 */
export const getCurrentUser = () => {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

/**
 * Log out user by clearing session
 */
export const logoutUser = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Failed to logout:', e);
  }
};

/**
 * Get NGO availability status for a given NGO id.
 * Returns 'available' | 'unavailable' | null (not yet set)
 */
export const getNgoAvailability = (ngoId) => {
  try {
    const data = localStorage.getItem(NGO_AVAILABILITY_KEY);
    const map = data ? JSON.parse(data) : {};
    return map[ngoId] !== undefined ? map[ngoId] : null;
  } catch (e) {
    return null;
  }
};

/**
 * Persist NGO availability status for a given NGO id.
 * Also updates the active session if the session belongs to this NGO.
 */
export const setNgoAvailability = (ngoId, status) => {
  try {
    const data = localStorage.getItem(NGO_AVAILABILITY_KEY);
    const map = data ? JSON.parse(data) : {};
    map[ngoId] = status;
    localStorage.setItem(NGO_AVAILABILITY_KEY, JSON.stringify(map));

    // Keep active session in sync
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      if (session.id === ngoId) {
        session.availability = status;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
    }
  } catch (e) {
    console.error('Failed to save NGO availability:', e);
  }
};

/**
 * Get all citizen reports
 */
export const getReports = () => {
  try {
    const data = localStorage.getItem(REPORTS_KEY);
    return data ? JSON.parse(data) : DEFAULT_DEMO_REPORTS;
  } catch (e) {
    return DEFAULT_DEMO_REPORTS;
  }
};

/**
 * Save a newly submitted report
 */
export const saveReport = ({ title, location, category, description, fileName, imageDataUrl }) => {
  const reports = getReports();
  const currentUser = getCurrentUser();

  const newReport = {
    id: `rep-${Date.now()}`,
    title: title.trim(),
    location: location.trim(),
    category: category || '',
    description: description.trim(),
    fileName: fileName || '',
    imageDataUrl: imageDataUrl || '',
    status: 'Submitted',
    createdAt: new Date().toISOString(),
    userEmail: currentUser?.email || 'citizen@urbanpulse.com',
  };

  const updatedReports = [newReport, ...reports];
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updatedReports));
  } catch (e) {
    console.error('Failed to save report:', e);
  }

  return newReport;
};

/**
 * Calculate Activity Stats
 */
export const getActivityStats = () => {
  const reports = getReports();
  const total = reports.length;
  const underReview = reports.filter((r) => r.status === 'Under Review').length;
  const resolved = reports.filter((r) => r.status === 'Resolved').length;

  return {
    total,
    underReview,
    resolved,
  };
};

/**
 * Accept an issue on behalf of an NGO.
 * Returns the updated report, or null if already accepted by another NGO.
 */
export const acceptReport = ({ reportId, ngoId, orgName }) => {
  const reports = getReports();
  const idx = reports.findIndex((r) => r.id === reportId);
  if (idx === -1) return null;

  const report = reports[idx];

  // Guard: already accepted by a different NGO
  if (report.status === 'Accepted' && report.acceptedByNgoId !== ngoId) {
    return null;
  }

  const updated = {
    ...report,
    status: 'Accepted',
    acceptedByNgoId: ngoId,
    acceptedByOrgName: orgName,
    acceptedAt: new Date().toISOString(),
  };

  const updatedReports = [...reports];
  updatedReports[idx] = updated;

  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updatedReports));
  } catch (e) {
    console.error('Failed to accept report:', e);
  }

  return updated;
};

/**
 * Advance an accepted report's status (Accepted → In Progress → Resolved).
 * Only the NGO that accepted the issue may update it.
 * Returns the updated report, or null on failure.
 */
export const updateReportStatus = ({ reportId, ngoId, status, note }) => {
  const ALLOWED_TRANSITIONS = {
    Accepted:    'In Progress',
    'In Progress': 'Resolved',
  };

  const reports = getReports();
  const idx = reports.findIndex((r) => r.id === reportId);
  if (idx === -1) return null;

  const report = reports[idx];

  // Guard: only the accepting NGO may update
  if (report.acceptedByNgoId !== ngoId) return null;

  // Guard: status must follow the allowed progression
  if (ALLOWED_TRANSITIONS[report.status] !== status) return null;

  const updated = {
    ...report,
    status,
    progressNote: note ? note.trim() : (report.progressNote || ''),
    statusUpdatedAt: new Date().toISOString(),
  };

  const updatedReports = [...reports];
  updatedReports[idx] = updated;

  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updatedReports));
  } catch (e) {
    console.error('Failed to update report status:', e);
  }

  return updated;
};
