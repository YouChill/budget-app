import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  addTransakcja: vi.fn(),
  updateTransakcja: vi.fn(),
  deleteTransakcja: vi.fn(),
}));
vi.mock('../../services/offlineQueue', () => ({ addToQueue: vi.fn() }));

import * as api from '../../services/api';
import { addToQueue } from '../../services/offlineQueue';
import { useTransactionActions } from '../useTransactionActions';

const base = [{ id: 'a', kwota: 10, kategoria: 'X' }];

function setup(isOffline) {
  const deps = {
    isOffline,
    userId: 'u1',
    transakcje: base,
    setTransakcje: vi.fn(),
    refresh: vi.fn().mockResolvedValue(),
    refreshPendingCount: vi.fn(),
    addToast: vi.fn(),
  };
  const { result } = renderHook(() => useTransactionActions(deps));
  return { result, deps };
}

describe('useTransactionActions — online', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dodanie: API, odświeżenie, toast, true', async () => {
    api.addTransakcja.mockResolvedValue({ success: true, id: 'n' });
    const { result, deps } = setup(false);
    let ok;
    await act(async () => { ok = await result.current.addTransaction({ kwota: 5 }); });
    expect(ok).toBe(true);
    expect(api.addTransakcja).toHaveBeenCalledWith({ kwota: 5 });
    expect(deps.refresh).toHaveBeenCalled();
    expect(deps.addToast).toHaveBeenCalledWith('Transakcja została dodana');
    expect(result.current.isSaving).toBe(false);
  });

  it('błąd zapisu: toast błędu, false (formularz zostaje otwarty)', async () => {
    api.updateTransakcja.mockRejectedValue(new Error('net'));
    const { result, deps } = setup(false);
    let ok;
    await act(async () => { ok = await result.current.editTransaction('a', { kwota: 1 }); });
    expect(ok).toBe(false);
    expect(deps.addToast).toHaveBeenCalledWith('Błąd podczas aktualizacji', 'error');
    expect(deps.refresh).not.toHaveBeenCalled();
  });
});

describe('useTransactionActions — offline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dodanie: UUID od razu, optymistycznie w stanie i w kolejce z userId', async () => {
    const { result, deps } = setup(true);
    await act(async () => { await result.current.addTransaction({ kwota: 7 }); });

    const [[next]] = deps.setTransakcje.mock.calls;
    const added = next[1];
    expect(added).toMatchObject({ kwota: 7, _offline: true });
    expect(added.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(addToQueue).toHaveBeenCalledWith({
      action: 'addTransakcja',
      userId: 'u1',
      payload: { action: 'addTransakcja', transakcja: { kwota: 7, id: added.id } },
    });
    expect(deps.refreshPendingCount).toHaveBeenCalled();
    expect(api.addTransakcja).not.toHaveBeenCalled();
  });

  it('edycja i usunięcie trafiają do kolejki z id', async () => {
    const { result, deps } = setup(true);
    await act(async () => { await result.current.editTransaction('a', { kwota: 11 }); });
    await act(async () => { await result.current.deleteTransaction('a'); });

    expect(deps.setTransakcje.mock.calls[0][0]).toEqual([{ id: 'a', kwota: 11, kategoria: 'X', _offline: true }]);
    expect(deps.setTransakcje.mock.calls[1][0]).toEqual([]);
    expect(addToQueue.mock.calls.map(c => [c[0].action, c[0].payload.id])).toEqual([
      ['updateTransakcja', 'a'],
      ['deleteTransakcja', 'a'],
    ]);
  });
});
