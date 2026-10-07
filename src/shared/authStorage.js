const ngoAvailability = new Map();

export const getNgoAvailability = (ngoId) => ngoAvailability.get(ngoId) || null;

export const setNgoAvailability = (ngoId, status) => {
  ngoAvailability.set(ngoId, status);
};
