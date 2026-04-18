import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  getBudgets: vi.fn(),
}));
vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import * as api from '../../services/api';
import { logger } from '../../utils/logger';
import { useBudgets } from '../useBudgets';

describe('useBudgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pobiera budżety przy montowaniu i zwraca je', async () => {
    api.getBudgets.mockResolvedValue([{ kategoria: 'Jedzenie', kwota: 1000 }]);
    const { result } = renderHook(() => useBudgets({ month: 2, year: 2026 }));
    await waitFor(() => {
      expect(result.current.budgets).toEqual([{ kategoria: 'Jedzenie', kwota: 1000 }]);
    });
    expect(api.getBudgets).toHaveBeenCalledWith(2, 2026);
  });

  it('zwraca pustą tablicę gdy API zwraca nie-tablicę', async () => {
    api.getBudgets.mockResolvedValue(null);
    const { result } = renderHook(() => useBudgets({ month: 1, year: 2026 }));
    await waitFor(() => {
      expect(api.getBudgets).toHaveBeenCalled();
    });
    expect(result.current.budgets).toEqual([]);
  });

  it('loguje ostrzeżenie i zostawia pustą listę przy błędzie', async () => {
    api.getBudgets.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useBudgets({ month: 1, year: 2026 }));
    await waitFor(() => {
      expect(logger.warn).toHaveBeenCalled();
    });
    expect(result.current.budgets).toEqual([]);
  });

  it('nie pobiera danych gdy enabled=false', () => {
    api.getBudgets.mockResolvedValue([]);
    renderHook(() => useBudgets({ month: 1, year: 2026, enabled: false }));
    expect(api.getBudgets).not.toHaveBeenCalled();
  });

  it('pobiera ponownie gdy zmienia się miesiąc lub rok', async () => {
    api.getBudgets.mockResolvedValue([]);
    const { rerender } = renderHook(
      ({ month, year }) => useBudgets({ month, year }),
      { initialProps: { month: 1, year: 2026 } }
    );
    await waitFor(() => {
      expect(api.getBudgets).toHaveBeenCalledWith(1, 2026);
    });
    rerender({ month: 2, year: 2026 });
    await waitFor(() => {
      expect(api.getBudgets).toHaveBeenCalledWith(2, 2026);
    });
    expect(api.getBudgets).toHaveBeenCalledTimes(2);
  });

  it('refresh() ponownie pobiera dane na żądanie', async () => {
    api.getBudgets.mockResolvedValue([]);
    const { result } = renderHook(() => useBudgets({ month: 1, year: 2026 }));
    await waitFor(() => {
      expect(api.getBudgets).toHaveBeenCalledTimes(1);
    });
    api.getBudgets.mockResolvedValue([{ kategoria: 'Transport', kwota: 500 }]);
    await act(async () => {
      await result.current.refresh();
    });
    expect(api.getBudgets).toHaveBeenCalledTimes(2);
    expect(result.current.budgets).toEqual([{ kategoria: 'Transport', kwota: 500 }]);
  });
});
