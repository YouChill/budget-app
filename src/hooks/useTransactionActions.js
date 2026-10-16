import { useState } from 'react';
import { addToQueue } from '../services/offlineQueue';
import * as api from '../services/api';
import { logger } from '../utils/logger';

// Dodawanie, edycja i usuwanie transakcji — online przez API, offline
// optymistycznie w stanie + kolejka do synchronizacji (usePendingOperations).
// Każda akcja zwraca true, gdy się powiodła (wywołujący zamyka wtedy formularz).
export function useTransactionActions({ isOffline, userId, transakcje, setTransakcje, refresh, refreshPendingCount, addToast }) {
  const [isSaving, setIsSaving] = useState(false);

  const enqueue = (action, payload) => {
    addToQueue({ action, userId, payload: { action, ...payload } });
    refreshPendingCount();
  };

  const addTransaction = async (transakcja) => {
    if (isOffline) {
      // Optimistic update + queue. Docelowe UUID nadajemy już teraz: ponowienie
      // po zgubionej odpowiedzi nie zrobi duplikatu, a edycja/usunięcie tej
      // transakcji przed synchronizacją trafi w ten sam rekord.
      const id = crypto.randomUUID();
      setTransakcje([...transakcje, { ...transakcja, id, _offline: true }]);
      enqueue('addTransakcja', { transakcja: { ...transakcja, id } });
      addToast('Transakcja zapisana offline — zsynchronizuje się po połączeniu');
      return true;
    }

    setIsSaving(true);
    try {
      const result = await api.addTransakcja(transakcja);
      if (result.success) {
        await refresh();
        addToast('Transakcja została dodana');
        return true;
      }
      addToast('Nie udało się dodać transakcji', 'error');
    } catch (err) {
      addToast('Błąd podczas zapisywania', 'error');
      logger.error('App', err);
    } finally {
      setIsSaving(false);
    }
    return false;
  };

  const editTransaction = async (id, transakcja) => {
    if (isOffline) {
      setTransakcje(transakcje.map(t => (t.id === id ? { ...t, ...transakcja, _offline: true } : t)));
      enqueue('updateTransakcja', { id, transakcja });
      addToast('Zmiana zapisana offline — zsynchronizuje się po połączeniu');
      return true;
    }

    setIsSaving(true);
    try {
      const result = await api.updateTransakcja(id, transakcja);
      if (result.success) {
        await refresh();
        addToast('Transakcja została zaktualizowana');
        return true;
      }
      addToast('Nie udało się zaktualizować transakcji', 'error');
    } catch (err) {
      addToast('Błąd podczas aktualizacji', 'error');
      logger.error('App', err);
    } finally {
      setIsSaving(false);
    }
    return false;
  };

  const deleteTransaction = async (id) => {
    if (isOffline) {
      setTransakcje(transakcje.filter(t => t.id !== id));
      // Także dla transakcji dodanej offline: kolejka wykona add, potem delete.
      enqueue('deleteTransakcja', { id });
      addToast('Usunięcie zapisane offline — zsynchronizuje się po połączeniu');
      return true;
    }

    try {
      const result = await api.deleteTransakcja(id);
      if (result.success !== false) {
        await refresh();
        addToast('Transakcja została usunięta');
        return true;
      }
      addToast('Nie udało się usunąć transakcji', 'error');
    } catch (err) {
      addToast('Błąd podczas usuwania', 'error');
      logger.error('App', err);
    }
    return false;
  };

  return { isSaving, addTransaction, editTransaction, deleteTransaction };
}
