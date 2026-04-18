import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useYearlyViewHint } from '../useYearlyViewHint';

const STORAGE_KEY = 'yearlyViewHintSeen';

describe('useYearlyViewHint', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pokazuje hint i pulse przy pierwszym uruchomieniu', () => {
    const { result } = renderHook(() => useYearlyViewHint());
    expect(result.current.showHint).toBe(true);
    expect(result.current.pulseActive).toBe(true);
  });

  it('nie pokazuje hintu gdy flaga w localStorage jest ustawiona', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useYearlyViewHint());
    expect(result.current.showHint).toBe(false);
    expect(result.current.pulseActive).toBe(false);
  });

  it('wyłącza pulse po 5 sekundach', () => {
    const { result } = renderHook(() => useYearlyViewHint());
    expect(result.current.pulseActive).toBe(true);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.pulseActive).toBe(false);
    expect(result.current.showHint).toBe(true);
  });

  it('dismissHint ukrywa hint, wyłącza pulse i zapisuje w localStorage', () => {
    const { result } = renderHook(() => useYearlyViewHint());
    act(() => {
      result.current.dismissHint();
    });
    expect(result.current.showHint).toBe(false);
    expect(result.current.pulseActive).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('dismissHint jest stabilny między renderami', () => {
    const { result, rerender } = renderHook(() => useYearlyViewHint());
    const first = result.current.dismissHint;
    rerender();
    expect(result.current.dismissHint).toBe(first);
  });
});
