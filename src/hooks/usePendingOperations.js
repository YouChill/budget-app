import { useCallback, useEffect, useRef, useState } from 'react';
import { getQueuedOperations, processQueue } from '../services/offlineQueue';

// Tracks offline queue size and auto-syncs when connectivity is restored —
// and after login, if the user still has operations queued from an earlier
// session (the queue lives in localStorage). Only operations of `userId` are
// counted and sent. `onSynced` is called after a flush so the caller can
// re-fetch server-side state. Callbacks are captured via refs so identity
// changes don't re-run the sync effect.
export function usePendingOperations({ isOffline, userId, onSynced, addToast }) {
  const [pendingCount, setPendingCount] = useState(() => getQueuedOperations(userId).length);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOfflineRef = useRef(isOffline);
  const syncedUserRef = useRef(null);

  const onSyncedRef = useRef(onSynced);
  const addToastRef = useRef(addToast);
  useEffect(() => { onSyncedRef.current = onSynced; }, [onSynced]);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  useEffect(() => {
    const backOnline = wasOfflineRef.current && !isOffline;
    const newUserOnline = !isOffline && userId && syncedUserRef.current !== userId;
    wasOfflineRef.current = isOffline;
    if (!backOnline && !newUserOnline) return;
    if (userId) syncedUserRef.current = userId;

    const syncQueue = async () => {
      const queue = getQueuedOperations(userId);
      setPendingCount(queue.length);
      if (queue.length === 0) return;

      setIsSyncing(true);
      try {
        const result = await processQueue(userId);
        if (result.succeeded > 0) {
          addToastRef.current?.(
            `Zsynchronizowano ${result.succeeded} ${result.succeeded === 1 ? 'operację' : 'operacji'}`
          );
        }
        if (result.failed > 0) {
          addToastRef.current?.(
            `Nie udało się zsynchronizować ${result.failed} operacji — spróbujemy ponownie`,
            'error'
          );
        }
        // Operacje, które się nie powiodły (i nie zostały porzucone), zostają
        // w kolejce do ponowienia — odzwierciedlamy to w liczniku.
        const stillPending = Math.max(0, (result.failed || 0) - (result.dropped || 0));
        setPendingCount(stillPending);
        await onSyncedRef.current?.();
      } finally {
        setIsSyncing(false);
      }
    };
    syncQueue();
  }, [isOffline, userId]);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueuedOperations(userId).length);
  }, [userId]);

  return { pendingCount, isSyncing, refreshPendingCount };
}
