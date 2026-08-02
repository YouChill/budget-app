import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  getAllData: vi.fn(),
  seedDefaultKategorie: vi.fn(),
  getKategorie: vi.fn(),
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
    // Domyślnie zasiew nic nie robi (gospodarstwo ma już kategorie).
    api.seedDefaultKategorie.mockResolvedValue({ success: true, seeded: 0 });
    api.getKategorie.mockResolvedValue({ Wydatek: {}, Przychód: {} });
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

  it('pobiera dane po przejściu enabled false -> true (logowanie)', async () => {
    api.getAllData.mockResolvedValue({
      transakcje: [],
      kategorie: { Wydatek: { Jedzenie: ['Lidl'] }, Przychód: {} },
      osoby: [],
    });

    const { result, rerender } = renderHook(
      ({ enabled }) => useMonthlyData({ month: 1, year: 2026, enabled }),
      { initialProps: { enabled: false } }
    );
    expect(api.getAllData).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(api.getAllData).toHaveBeenCalledTimes(1);
    expect(result.current.kategorie).toEqual({ Wydatek: { Jedzenie: ['Lidl'] }, Przychód: {} });
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

  it('zasiewa domyślne kategorie gdy gospodarstwo jest puste', async () => {
    api.getAllData.mockResolvedValue({
      transakcje: [],
      kategorie: { Wydatek: {}, Przychód: {} },
      osoby: [],
    });
    api.seedDefaultKategorie.mockResolvedValue({ success: true, seeded: 3 });
    api.getKategorie.mockResolvedValue({
      Wydatek: { Jedzenie: ['Zakupy domowe'] },
      Przychód: {},
    });

    const { result } = renderHook(() => useMonthlyData({ month: 1, year: 2026 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(api.seedDefaultKategorie).toHaveBeenCalledTimes(1);
    expect(result.current.kategorie).toEqual({
      Wydatek: { Jedzenie: ['Zakupy domowe'] },
      Przychód: {},
    });
  });

  it('ponawia getKategorie gdy słownik pusty mimo seeded=0 (przejściowy błąd)', async () => {
    // getAllData połknęło błąd getKategorie i zwróciło pusty słownik,
    // choć gospodarstwo ma kategorie (seed nic nie wstawia).
    api.getAllData.mockResolvedValue({
      transakcje: [{ id: '1', kwota: 10 }],
      kategorie: { Wydatek: {}, Przychód: {} },
      osoby: [],
    });
    api.seedDefaultKategorie.mockResolvedValue({ success: true, seeded: 0 });
    api.getKategorie.mockResolvedValue({
      Wydatek: { Jedzenie: ['Lidl'] },
      Przychód: {},
    });

    const { result } = renderHook(() => useMonthlyData({ month: 1, year: 2026 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(api.getKategorie).toHaveBeenCalledTimes(1);
    expect(result.current.kategorie).toEqual({
      Wydatek: { Jedzenie: ['Lidl'] },
      Przychód: {},
    });
  });

  it('nie zasiewa gdy kategorie już istnieją', async () => {
    api.getAllData.mockResolvedValue({
      transakcje: [],
      kategorie: { Wydatek: { Jedzenie: ['Lidl'] }, Przychód: {} },
      osoby: [],
    });

    const { result } = renderHook(() => useMonthlyData({ month: 1, year: 2026 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(api.seedDefaultKategorie).not.toHaveBeenCalled();
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
