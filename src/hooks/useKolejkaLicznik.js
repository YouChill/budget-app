import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import { logger } from '../utils/logger';

const iso = (rok, miesiac, dzien) =>
  `${rok}-${String(miesiac).padStart(2, '0')}-${String(dzien).padStart(2, '0')}`;

/**
 * Liczniki kolejki importu (#132): wszystkie operacje w statusie 'nowy'
 * (przycisk w nagłówku) i te z oglądanego miesiąca (baner „sumy są
 * niepełne"). null = baza bez migracji kolejki albo offline.
 */
export function useKolejkaLicznik({ month, year, enabled = true }) {
  const [liczniki, setLiczniki] = useState({ wszystkie: null, wMiesiacu: null });

  const refresh = useCallback(async () => {
    try {
      const ostatni = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const [wszystkie, wMiesiacu] = await Promise.all([
        api.getLicznikKolejki(),
        api.getLicznikKolejki({ od: iso(year, month, 1), do: iso(year, month, ostatni) }),
      ]);
      setLiczniki({ wszystkie, wMiesiacu });
    } catch (err) {
      logger.warn('useKolejkaLicznik', 'Nie udało się pobrać licznika kolejki', err);
    }
  }, [month, year]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  return { ...liczniki, refresh };
}
