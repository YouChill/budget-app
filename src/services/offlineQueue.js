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

/**
 * Process all queued operations sequentially via Supabase API.
 * Returns { succeeded: number, failed: number, errors: string[] }
 */
export async function processQueue() {
  const queue = getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0, errors: [] };

  let succeeded = 0;
  let failed = 0;
  const errors = [];

  for (const op of queue) {
    try {
      await processOfflineOperation(op);
      succeeded++;
    } catch (err) {
      failed++;
      errors.push(err.message || `Operacja ${op.action} nie powiodla sie`);
    }
  }

  // Clear the queue regardless — failed items should not retry indefinitely.
  // The data will be refreshed from the server after sync.
  clearQueue();

  return { succeeded, failed, errors };
}
