import { useCallback, useEffect, useState } from 'react';

export default function useUrlFilters(defaults) {
  const read = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, params.get(key) ?? fallback]));
  }, [defaults]);
  const [filters, setFiltersState] = useState(read);

  useEffect(() => {
    const syncFromUrl = () => setFiltersState(read());
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [read]);

  const setFilters = useCallback((updates) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    setFiltersState((current) => ({ ...current, ...updates }));
  }, []);

  return [filters, setFilters];
}
