// używane przez widok Do rozliczenia (#132)
import { useEffect, useState } from 'react';
import * as categoryAI from '../../services/categoryAI';
import { validateCategoryExists } from '../../lib/csvImport/kategoryzacja';
import { logger } from '../../utils/logger';

// Przebieg AI po wejściu w krok 3: wiersze bez dopasowanej kategorii
// (Inne/Nieprzewidziane) dostają propozycję z embeddingów, zweryfikowaną
// względem słownika kategorii. Uruchamiany raz na wejście w krok 3.
export function useAiCategorization({ step, aiEnabled, transactions, setTransactions, kategorie }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMatchCount, setAiMatchCount] = useState(0);

  useEffect(() => {
    if (step !== 3 || !aiEnabled) return;

    const uncategorizedIndices = transactions
      .map((tx, i) => ({ tx, i }))
      .filter(({ tx }) => tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane');

    if (uncategorizedIndices.length === 0) return;

    setAiLoading(true);
    setAiMatchCount(0);

    let cancelled = false;
    const run = async () => {
      try {
        const descriptions = transactions.map(tx => tx.opis || '');
        const aiResults = await categoryAI.categorizeWithAI(descriptions);
        if (cancelled) return;

        let matched = 0;
        setTransactions(prev =>
          prev.map((tx, i) => {
            if (tx.kategoria !== 'Inne' || tx.podkategoria !== 'Nieprzewidziane') return tx;
            if (!aiResults[i]) return tx;
            const validated = validateCategoryExists(
              aiResults[i].kategoria,
              aiResults[i].podkategoria,
              kategorie,
              tx.typ,
              tx.opis
            );
            if (validated.kategoria !== 'Inne') matched++;
            return { ...tx, ...validated };
          })
        );
        setAiMatchCount(matched);
      } catch (err) {
        if (!cancelled) logger.error('CSVImport', 'AI categorization pass failed:', err);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return { aiLoading, aiMatchCount };
}
