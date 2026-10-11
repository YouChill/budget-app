import { useEffect, useState } from 'react';

export const STORAGE_KEY = 'csv_import_progress';
const TTL_MS = 24 * 60 * 60 * 1000;

// Postęp importu w localStorage: autozapis w kroku 3 i propozycja
// przywrócenia (do 24 h) przy ponownym otwarciu — zamiast window.confirm
// pokazujemy spójny dialog (restorePrompt).
export function useImportProgress({ step, transactions, txMeta, dedupInfo, selectedOsoba }) {
  const [lastSaved, setLastSaved] = useState(null);
  const [restorePrompt, setRestorePrompt] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const { timestamp, transactions: savedTx, txMeta: savedMeta, step: savedStep, dedupInfo: savedDedup, osoba: savedOsoba } = parsed;
      if (Date.now() - timestamp < TTL_MS && savedTx?.length > 0) {
        setRestorePrompt({ savedTx, savedMeta, savedStep, savedDedup, savedOsoba });
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (step === 3 && transactions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), transactions, txMeta, step, dedupInfo, osoba: selectedOsoba }));
        setLastSaved(new Date());
      } catch { /* ignore */ }
    }
  }, [transactions, txMeta, step, dedupInfo, selectedOsoba]);

  const clearProgress = () => localStorage.removeItem(STORAGE_KEY);

  // Zwraca zapisany stan do odtworzenia i zamyka dialog.
  const takeRestore = () => {
    const saved = restorePrompt;
    setRestorePrompt(null);
    return saved;
  };

  const discardRestore = () => {
    clearProgress();
    setRestorePrompt(null);
  };

  return { lastSaved, restorePrompt, takeRestore, discardRestore, clearProgress };
}
