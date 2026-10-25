import { useEffect, useState } from 'react';
import * as categoryAI from '../../services/categoryAI';
import { validateCategoryExists } from '../../lib/csvImport/kategoryzacja';
import { logger } from '../../utils/logger';

// Przebieg AI po załadowaniu kolejki: wiersze bez dopasowanej kategorii
// (Inne/Nieprzewidziane) dostają propozycję z embeddingów, zweryfikowaną
// względem słownika kategorii. Uruchamiany raz na każde załadowanie listy
// (`uruchom` — licznik załadowań; 0 = jeszcze nie). Propozycje nie trafiają
// do bazy — tylko do stanu widoku.
export function useAiCategorization({ uruchom, aiEnabled, transactions, setTransactions, kategorie }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMatchCount, setAiMatchCount] = useState(0);

  useEffect(() => {
    if (!uruchom || !aiEnabled) return;

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
        // Po dowodId, nie po indeksie — lista mogła się zmienić w trakcie
        // (wykluczenie wiersza, zatwierdzenie partii).
        const propozycje = new Map();
        transactions.forEach((tx, i) => {
          if (!aiResults[i] || tx.kategoria !== 'Inne' || tx.podkategoria !== 'Nieprzewidziane') return;
          const validated = validateCategoryExists(aiResults[i].kategoria, aiResults[i].podkategoria, kategorie, tx.typ, tx.opis);
          if (validated.kategoria !== 'Inne') propozycje.set(tx.dowodId, validated);
        });

        // Po dowodId, nie po indeksie — lista mogła się zmienić w trakcie
        // (wykluczenie wiersza, zatwierdzenie partii). Wiersz z propozycją AI
        // trafia do domyślnie zaznaczonych.
        setTransactions(prev =>
          prev.map((tx) => {
            const p = propozycje.get(tx.dowodId);
            if (!p || tx.kategoria !== 'Inne' || tx.podkategoria !== 'Nieprzewidziane') return tx;
            return { ...tx, ...p, _dedup: { ...tx._dedup, wybrana: true } };
          })
        );
        const matched = propozycje.size;
        setAiMatchCount(matched);
      } catch (err) {
        if (!cancelled) logger.error('Kolejka', 'AI categorization pass failed:', err);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uruchom]);

  return { aiLoading, aiMatchCount };
}
