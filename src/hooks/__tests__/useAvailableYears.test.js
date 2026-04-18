import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  getAvailableYears: vi.fn(),
}));

import * as api from '../../services/api';
import { useAvailableYears } from '../useAvailableYears';

describe('useAvailableYears', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zwraca bieżący rok na początku (przed rozwiązaniem promise)', () => {
    api.getAvailableYears.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAvailableYears());
    expect(result.current).toEqual([new Date().getFullYear()]);
  });

  it('aktualizuje listę po rozwiązaniu api.getAvailableYears', async () => {
    api.getAvailableYears.mockResolvedValue([2026, 2025, 2024]);
    const { result } = renderHook(() => useAvailableYears());
    await waitFor(() => {
      expect(result.current).toEqual([2026, 2025, 2024]);
    });
  });

  it('nie wywołuje API gdy enabled=false', () => {
    api.getAvailableYears.mockResolvedValue([2026]);
    renderHook(() => useAvailableYears({ enabled: false }));
    expect(api.getAvailableYears).not.toHaveBeenCalled();
  });

  it('wywołuje API gdy enabled=true', async () => {
    api.getAvailableYears.mockResolvedValue([2026]);
    const { result } = renderHook(() => useAvailableYears({ enabled: true }));
    await waitFor(() => {
      expect(result.current).toEqual([2026]);
    });
    expect(api.getAvailableYears).toHaveBeenCalledTimes(1);
  });

  it('ignoruje błędy API i zostawia wartość początkową', async () => {
    api.getAvailableYears.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAvailableYears());
    await waitFor(() => {
      expect(api.getAvailableYears).toHaveBeenCalled();
    });
    expect(result.current).toEqual([new Date().getFullYear()]);
  });

  it('nie aktualizuje stanu po unmount (cancellation flag)', async () => {
    let resolve;
    api.getAvailableYears.mockReturnValue(new Promise(r => { resolve = r; }));
    const { result, unmount } = renderHook(() => useAvailableYears());
    const initial = result.current;
    unmount();
    resolve([1999, 2000]);
    await new Promise(r => setTimeout(r, 0));
    expect(result.current).toBe(initial);
  });
});
