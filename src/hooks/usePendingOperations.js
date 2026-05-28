import { useCallback, useEffect, useRef, useState } from 'react';
import { getQueuedOperations, processQueue } from '../services/offlineQueue';

// Tracks offline queue size and auto-syncs when connectivity is restored.
// `onSynced` is called after a successful flush so the caller can re-fetch
// server-side state. Callbacks are captured via refs so identity changes
// don't re-run the sync effect.
export function usePendingOperations({ isOffline, onSynced, addToast }) {
  const [pendingCount, setPendingCount] = useState(() => getQueuedOperations().length);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOfflineRef = useRef(isOffline);

  const onSyncedRef = useRef(onSynced);
  const addToastRef = useRef(addToast);
  useEffect(() => { onSyncedRef.current = onSynced; }, [onSynced]);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  useEffect(() => {
    if (wasOfflineRef.current && !isOffline) {
      const syncQueue = async () => {
        const queue = getQueuedOperations();
        if (queue.length === 0) {
          wasOfflineRef.current = false;
          return;
        }
        setIsSyncing(true);
        try {
          const result = await processQueue();
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
    }
    wasOfflineRef.current = isOffline;
  }, [isOffline]);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueuedOperations().length);
  }, []);

  return { pendingCount, isSyncing, refreshPendingCount };
}
