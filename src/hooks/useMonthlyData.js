import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../services/api';
import { logger } from '../utils/logger';

// Czy struktura kategorii jest pusta (brak jakiejkolwiek kategorii w obu typach).
function kategorieEmpty(kategorie) {
  if (!kategorie) return true;
  return Object.values(kategorie).every(
    grupa => !grupa || Object.keys(grupa).length === 0
  );
}

// Owns state for transakcje + kategorie + osoby + isLoading + error and
// fetches them for the given period. Setters are exposed so callers can
// perform optimistic updates (CRUD) and settings panels can push changes
// back into state without a round-trip.
export function useMonthlyData({ month, year, enabled = true }) {
  const [transakcje, setTransakcje] = useState([]);
  const [kategorie, setKategorie] = useState({ Wydatek: {}, Przychód: {} });
  const [osoby, setOsoby] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Zasiew domyślnych kategorii próbujemy tylko raz na sesję, by uniknąć pętli.
  const seedAttemptedRef = useRef(false);

  const refresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    setError(null);

    if (!navigator.onLine) {
      setError('Brak połączenia z internetem.');
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getAllData(month, year);
      setTransakcje(Array.isArray(data.transakcje) ? data.transakcje : []);
      setOsoby(Array.isArray(data.osoby) ? data.osoby : []);

      let kategorie = data.kategorie || { Wydatek: {}, Przychód: {} };
      // Nowe/puste gospodarstwo nie ma kategorii — zasiej domyślny zestaw,
      // żeby formularz dodawania transakcji miał z czego wybierać.
      if (kategorieEmpty(kategorie) && !seedAttemptedRef.current) {
        seedAttemptedRef.current = true;
        try {
          const { seeded } = await api.seedDefaultKategorie();
          if (seeded > 0) {
            kategorie = await api.getKategorie();
          }
        } catch (seedErr) {
          logger.error('useMonthlyData:seed', seedErr);
        }
      }
      setKategorie(kategorie);
    } catch (err) {
      setError('Nie udało się pobrać danych. Sprawdź połączenie i odśwież stronę.');
      logger.error('useMonthlyData', err);
    } finally {
      setIsLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  return {
    transakcje,
    kategorie,
    osoby,
    isLoading,
    error,
    setTransakcje,
    setKategorie,
    setOsoby,
    setError,
    refresh,
  };
}
