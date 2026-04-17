import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import { logger } from '../utils/logger';

export function useBudgets({ month, year, enabled = true }) {
  const [budgets, setBudgets] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getBudgets(month, year);
      setBudgets(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.warn('useBudgets', 'Nie udało się pobrać budżetów', err);
    }
  }, [month, year]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  return { budgets, refresh };
}
