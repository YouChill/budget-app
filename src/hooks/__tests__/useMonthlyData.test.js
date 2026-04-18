import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  getAllData: vi.fn(),
}));
vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import * as api from '../../services/api';
import { logger } from '../../utils/logger';
import { useMonthlyData } from '../useMonthlyData';

const setOnline = (online) => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
};

describe('useMonthlyData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnline(true);
  });

  afterEach(() => {
    setOnline(true);
  });

  it('pobiera dane i wypełnia stan', async () => {
    api.getAllData.mockResolvedValue({
      transakcje: [{ id: '1', kwota: 10 }],
      kategorie: { Wydatek: { Jedzenie: ['Lidl'] }, Przychód: {} },
      osoby: ['Jan'],
    });

    const { result } = renderHook(() => useMonthlyData({ month: 2, year: 2026 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.transakcje).toEqual([{ id: '1', kwota: 10 }]);
    expect(result.current.kategorie).toEqual({ Wydatek: { Jedzenie: ['Lidl'] }, Przychód: {} });
    expect(result.current.osoby).toEqual(['Jan']);
    expect(result.current.error).toBeNull();
    expect(api.getAllData).toHaveBeenCalledWith(2, 2026);
  });

  it('ustawia error i puste dane gdy offline', async () => {
    setOnline(false);
    const { result } = renderHook(() => useMonthlyData({ month: 1, year: 2026 }));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toMatch(/połączenia/i);
    expect(api.getAllData).not.toHaveBeenCalled();
  });

  it('ustawia error i loguje przy wyjątku API', async () => {
    api.getAllData.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useMonthlyData({ month: 1, year: 2026 }));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toMatch(/Nie udało się/);
    expect(logger.error).toHaveBeenCalled();
  });

  it('nie pobiera danych gdy enabled=false', () => {
    renderHook(() => useMonthlyData({ month: 1, year: 2026, enabled: false }));
    expect(api.getAllData).not.toHaveBeenCalled();
  });

  it('odpornie traktuje brak pól w odpowiedzi API', async () => {
    api.getAllData.mockResolvedValue({});
    const { result } = renderHook(() => useMonthlyData({ month: 1, year: 2026 }));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.transakcje).toEqual([]);
    expect(result.current.kategorie).toEqual({ Wydatek: {}, Przychód: {} });
    expect(result.current.osoby).toEqual([]);
  });

  it('setTransakcje pozwala na optimistic update', async () => {
    api.getAllData.mockResolvedValue({ transakcje: [], kategorie: {}, osoby: [] });
    const { result } = renderHook(() => useMonthlyData({ month: 1, year: 2026 }));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    act(() => {
      result.current.setTransakcje([{ id: 'x', kwota: 99 }]);
    });
    expect(result.current.transakcje).toEqual([{ id: 'x', kwota: 99 }]);
  });

  it('refresh(false) nie pokazuje spinnera', async () => {
    api.getAllData.mockResolvedValue({ transakcje: [], kategorie: {}, osoby: [] });
    const { result } = renderHook(() => useMonthlyData({ month: 1, year: 2026 }));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    let pending;
    await act(async () => {
      pending = result.current.refresh(false);
      await pending;
    });
    expect(result.current.isLoading).toBe(false);
  });
});
