import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock api module before importing offlineQueue
vi.mock('../api', () => ({
  processOfflineOperation: vi.fn(),
}));

import { addToQueue, getQueuedOperations, clearQueue, removeFromQueue, processQueue } from '../offlineQueue';
import { processOfflineOperation } from '../api';

describe('offlineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ─── addToQueue ─────────────────────────────────────────────────────────────

  describe('addToQueue', () => {
    it('dodaje operację addTransakcja do kolejki', () => {
      addToQueue({ action: 'addTransakcja', payload: { transakcja: { data: '2026-01-01', kwota: 100 } } });
      const queue = getQueuedOperations();
      expect(queue).toHaveLength(1);
      expect(queue[0].action).toBe('addTransakcja');
    });

    it('dodaje operację updateTransakcja do kolejki', () => {
      addToQueue({ action: 'updateTransakcja', payload: { id: '1', transakcja: {} } });
      const queue = getQueuedOperations();
      expect(queue[0].action).toBe('updateTransakcja');
    });

    it('dodaje operację deleteTransakcja do kolejki', () => {
      addToQueue({ action: 'deleteTransakcja', payload: { id: '1' } });
      const queue = getQueuedOperations();
      expect(queue[0].action).toBe('deleteTransakcja');
    });

    it('generuje unikalny id dla każdej operacji', () => {
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      const queue = getQueuedOperations();
      expect(queue[0].id).not.toBe(queue[1].id);
    });

    it('zapisuje timestamp dla każdej operacji', () => {
      const before = Date.now();
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      const after = Date.now();
      const queue = getQueuedOperations();
      expect(queue[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(queue[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('zwraca aktualną kolejkę po dodaniu', () => {
      const result = addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('rzuca błąd dla nieznanej akcji', () => {
      expect(() =>
        addToQueue({ action: 'sendEmail', payload: {} })
      ).toThrow('Nieznana operacja offline: sendEmail');
    });

    it('rzuca błąd gdy brak action', () => {
      expect(() =>
        addToQueue({ payload: {} })
      ).toThrow('Nieznana operacja offline');
    });

    it('rzuca błąd gdy action jest null', () => {
      expect(() =>
        addToQueue({ action: null, payload: {} })
      ).toThrow();
    });

    it('rzuca błąd gdy brak payload', () => {
      expect(() =>
        addToQueue({ action: 'addTransakcja' })
      ).toThrow('Operacja offline bez danych (payload)');
    });

    it('rzuca błąd gdy operation jest null', () => {
      expect(() => addToQueue(null)).toThrow();
    });

    it('zachowuje kolejność dodawania operacji', () => {
      addToQueue({ action: 'addTransakcja', payload: { transakcja: { kwota: 10 } } });
      addToQueue({ action: 'deleteTransakcja', payload: { id: '99' } });
      addToQueue({ action: 'updateTransakcja', payload: { id: '1', transakcja: {} } });
      const queue = getQueuedOperations();
      expect(queue[0].action).toBe('addTransakcja');
      expect(queue[1].action).toBe('deleteTransakcja');
      expect(queue[2].action).toBe('updateTransakcja');
    });
  });

  // ─── getQueuedOperations ────────────────────────────────────────────────────

  describe('getQueuedOperations', () => {
    it('zwraca pustą tablicę gdy brak operacji', () => {
      expect(getQueuedOperations()).toEqual([]);
    });

    it('zwraca wszystkie dodane operacje', () => {
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      addToQueue({ action: 'deleteTransakcja', payload: { id: '1' } });
      expect(getQueuedOperations()).toHaveLength(2);
    });

    it('zwraca pustą tablicę gdy localStorage zawiera uszkodzone dane', () => {
      localStorage.setItem('budget_offline_queue', 'invalid-json{{{');
      expect(getQueuedOperations()).toEqual([]);
    });
  });

  // ─── clearQueue ─────────────────────────────────────────────────────────────

  describe('clearQueue', () => {
    it('usuwa wszystkie operacje z kolejki', () => {
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      addToQueue({ action: 'deleteTransakcja', payload: { id: '1' } });
      clearQueue();
      expect(getQueuedOperations()).toHaveLength(0);
    });

    it('nie rzuca błędu gdy kolejka jest już pusta', () => {
      expect(() => clearQueue()).not.toThrow();
    });
  });

  // ─── removeFromQueue ────────────────────────────────────────────────────────

  describe('removeFromQueue', () => {
    it('usuwa operację o podanym id', () => {
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      const queue = getQueuedOperations();
      removeFromQueue(queue[0].id);
      expect(getQueuedOperations()).toHaveLength(0);
    });

    it('nie usuwa innych operacji', () => {
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      addToQueue({ action: 'deleteTransakcja', payload: { id: '1' } });
      const queue = getQueuedOperations();
      removeFromQueue(queue[0].id);
      const remaining = getQueuedOperations();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].action).toBe('deleteTransakcja');
    });

    it('zwraca pustą tablicę po usunięciu jedynej operacji', () => {
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      const queue = getQueuedOperations();
      const result = removeFromQueue(queue[0].id);
      expect(result).toHaveLength(0);
    });

    it('nie zmienia kolejki gdy id nie istnieje', () => {
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      removeFromQueue('non-existent-id');
      expect(getQueuedOperations()).toHaveLength(1);
    });
  });

  // ─── processQueue ───────────────────────────────────────────────────────────

  describe('processQueue', () => {
    it('zwraca 0 sukcesów i 0 błędów dla pustej kolejki', async () => {
      const result = await processQueue();
      expect(result).toEqual({ succeeded: 0, failed: 0, errors: [] });
    });

    it('przetwarza operację i czyści kolejkę po sukcesie', async () => {
      processOfflineOperation.mockResolvedValue({ success: true });
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });

      const result = await processQueue();

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(getQueuedOperations()).toHaveLength(0);
    });

    it('zlicza błędy gdy operacja się nie powiedzie', async () => {
      processOfflineOperation.mockRejectedValue(new Error('Network error'));
      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });

      const result = await processQueue();

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Network error');
    });

    it('czyści kolejkę nawet gdy część operacji się nie powiedzie', async () => {
      processOfflineOperation
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Failed'));

      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      addToQueue({ action: 'deleteTransakcja', payload: { id: '1' } });

      const result = await processQueue();

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(getQueuedOperations()).toHaveLength(0);
    });

    it('przetwarza wiele operacji sekwencyjnie', async () => {
      processOfflineOperation.mockResolvedValue({ success: true });

      addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } });
      addToQueue({ action: 'updateTransakcja', payload: { id: '1', transakcja: {} } });
      addToQueue({ action: 'deleteTransakcja', payload: { id: '2' } });

      const result = await processQueue();

      expect(processOfflineOperation).toHaveBeenCalledTimes(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
    });
  });

  // ─── saveQueue QuotaExceededError ───────────────────────────────────────────

  describe('saveQueue - obsługa przepełnienia localStorage', () => {
    it('rzuca błąd gdy localStorage jest pełne', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        const err = new DOMException('QuotaExceededError');
        Object.defineProperty(err, 'name', { value: 'QuotaExceededError' });
        throw err;
      });

      expect(() =>
        addToQueue({ action: 'addTransakcja', payload: { transakcja: {} } })
      ).toThrow();
    });
  });
});
