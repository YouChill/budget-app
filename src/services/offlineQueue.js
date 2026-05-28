import { processOfflineOperation } from './api';
import { logger } from '../utils/logger';

const QUEUE_KEY = 'budget_offline_queue';
const VALID_ACTIONS = ['addTransakcja', 'updateTransakcja', 'deleteTransakcja'];

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      logger.error('OfflineQueue', 'localStorage pełne — nie można zapisać kolejki offline', err);
    }
    throw err;
  }
}

export function addToQueue(operation) {
  if (!operation?.action || !VALID_ACTIONS.includes(operation.action)) {
    throw new Error(`Nieznana operacja offline: ${operation?.action}`);
  }
  if (!operation.payload) {
    throw new Error('Operacja offline bez danych (payload)');
  }
  const queue = getQueue();
  queue.push({
    ...operation,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  });
  saveQueue(queue);
  return queue;
}

export function getQueuedOperations() {
  return getQueue();
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function removeFromQueue(operationId) {
  const queue = getQueue().filter(op => op.id !== operationId);
  saveQueue(queue);
  return queue;
}

// Maksymalna liczba prób synchronizacji jednej operacji. Po jej przekroczeniu
// operacja jest porzucana, aby trwale błędny wpis nie blokował kolejki w
// nieskończoność.
const MAX_ATTEMPTS = 3;

/**
 * Process all queued operations sequentially via Supabase API.
 *
 * Operacje zakończone sukcesem są usuwane z kolejki. Operacje, które się nie
 * powiodły (np. chwilowy błąd sieci), pozostają w kolejce z inkrementowanym
 * licznikiem prób i zostaną ponowione przy następnej synchronizacji — dzięki
 * temu nie tracimy danych użytkownika po nieudanym flushu. Dopiero po
 * MAX_ATTEMPTS nieudanych prób wpis jest porzucany.
 *
 * Returns { succeeded: number, failed: number, dropped: number, errors: string[] }
 */
export async function processQueue() {
  const queue = getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0, dropped: 0, errors: [] };

  let succeeded = 0;
  let failed = 0;
  let dropped = 0;
  const errors = [];
  const remaining = [];

  for (const op of queue) {
    try {
      await processOfflineOperation(op);
      succeeded++;
    } catch (err) {
      failed++;
      errors.push(err.message || `Operacja ${op.action} nie powiodla sie`);
      const attempts = (op.attempts || 0) + 1;
      if (attempts < MAX_ATTEMPTS) {
        remaining.push({ ...op, attempts });
      } else {
        dropped++;
      }
    }
  }

  // Zachowaj nieudane (jeszcze ponowialne) operacje; jeśli zapis się nie uda
  // (np. quota), w ostateczności wyczyść, by nie zablokować aplikacji.
  try {
    if (remaining.length > 0) saveQueue(remaining);
    else clearQueue();
  } catch {
    clearQueue();
  }

  return { succeeded, failed, dropped, errors };
}
