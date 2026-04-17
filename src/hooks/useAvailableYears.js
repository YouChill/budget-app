import { useEffect, useState } from 'react';
import * as api from '../services/api';

// Fetch available years for the yearly summary view. Falls back to the
// current year on error or when disabled.
export function useAvailableYears({ enabled = true } = {}) {
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api.getAvailableYears()
      .then(years => {
        if (!cancelled) setAvailableYears(years);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return availableYears;
}
