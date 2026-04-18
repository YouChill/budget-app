import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../services/offlineQueue', () => ({
  getQueuedOperations: vi.fn(),
  processQueue: vi.fn(),
}));

import { getQueuedOperations, processQueue } from '../../services/offlineQueue';
import { usePendingOperations } from '../usePendingOperations';

describe('usePendingOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getQueuedOperations.mockReturnValue([]);
  });

  it('zwraca początkową liczbę oczekujących operacji', () => {
    getQueuedOperations.mockReturnValue([{}, {}, {}]);
    const { result } = renderHook(() =>
      usePendingOperations({ isOffline: false, onSynced: vi.fn(), addToast: vi.fn() })
    );
    expect(result.current.pendingCount).toBe(3);
    expect(result.current.isSyncing).toBe(false);
  });

  it('nie uruchamia sync gdy zawsze online (żadna zmiana offline→online)', async () => {
    const { result } = renderHook(() =>
      usePendingOperations({ isOffline: false, onSynced: vi.fn(), addToast: vi.fn() })
    );
    await new Promise(r => setTimeout(r, 0));
    expect(processQueue).not.toHaveBeenCalled();
    expect(result.current.isSyncing).toBe(false);
  });

  it('uruchamia processQueue po zmianie offline→online z niepustą kolejką', async () => {
    getQueuedOperations.mockReturnValue([{ id: 1 }, { id: 2 }]);
    processQueue.mockResolvedValue({ succeeded: 2, failed: 0 });
    const onSynced = vi.fn().mockResolvedValue();
    const addToast = vi.fn();

    const { rerender, result } = renderHook(
      ({ isOffline }) => usePendingOperations({ isOffline, onSynced, addToast }),
      { initialProps: { isOffline: true } }
    );

    rerender({ isOffline: false });

    await waitFor(() => {
      expect(processQueue).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onSynced).toHaveBeenCalled();
    });
    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('2'));
    expect(result.current.pendingCount).toBe(0);
  });

  it('nie uruchamia sync gdy kolejka jest pusta po powrocie online', async () => {
    getQueuedOperations.mockReturnValue([]);
    const { rerender } = renderHook(
      ({ isOffline }) => usePendingOperations({ isOffline, onSynced: vi.fn(), addToast: vi.fn() }),
      { initialProps: { isOffline: true } }
    );
    rerender({ isOffline: false });
    await new Promise(r => setTimeout(r, 10));
    expect(processQueue).not.toHaveBeenCalled();
  });

  it('wyświetla toast błędu gdy część operacji nie powiodła się', async () => {
    getQueuedOperations.mockReturnValue([{ id: 1 }, { id: 2 }]);
    processQueue.mockResolvedValue({ succeeded: 1, failed: 1 });
    const addToast = vi.fn();

    const { rerender } = renderHook(
      ({ isOffline }) => usePendingOperations({ isOffline, onSynced: vi.fn(), addToast }),
      { initialProps: { isOffline: true } }
    );
    rerender({ isOffline: false });

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith(expect.stringContaining('1'), 'error');
    });
  });

  it('refreshPendingCount aktualizuje licznik z aktualnego stanu kolejki', () => {
    getQueuedOperations.mockReturnValue([]);
    const { result } = renderHook(() =>
      usePendingOperations({ isOffline: false, onSynced: vi.fn(), addToast: vi.fn() })
    );
    expect(result.current.pendingCount).toBe(0);
    getQueuedOperations.mockReturnValue([{}, {}]);
    act(() => {
      result.current.refreshPendingCount();
    });
    expect(result.current.pendingCount).toBe(2);
  });
});
