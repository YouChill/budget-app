import { useMemo, useState } from 'react';
import { sortTransactionsByDate } from '../utils/calculations';

// Grupowanie posortowanej listy po dniu, z saldem dnia (przychody − wydatki).
export function groupByDay(transakcje) {
  const groups = [];
  let current = null;
  transakcje.forEach(t => {
    const key = t.data ? String(t.data).slice(0, 10) : '';
    if (!current || current.key !== key) {
      current = { key, items: [], net: 0 };
      groups.push(current);
    }
    current.items.push(t);
    const kwota = Number(t.kwota) || 0;
    current.net += t.typ === 'Wydatek' ? -kwota : kwota;
  });
  return groups;
}

// Wyszukiwanie, filtr kategorii i grupowanie listy transakcji po dniu.
export function useTransactionFilters(transakcje) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const sortedTransakcje = useMemo(() => sortTransactionsByDate(transakcje), [transakcje]);

  const filteredTransakcje = useMemo(() => {
    let result = sortedTransakcje;
    if (selectedCategory) {
      // Fallback „Inne" musi odpowiadać grupowaniu na wykresie:
      // transakcje bez kategorii trafiają tam do „Inne"
      result = result.filter(t => (t.kategoria || 'Inne') === selectedCategory);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return result;
    return result.filter(t =>
      [t.kategoria, t.podkategoria, t.osoba, t.komentarz, String(t.kwota)]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    );
  }, [sortedTransakcje, searchQuery, selectedCategory]);

  const groupedByDay = useMemo(() => groupByDay(filteredTransakcje), [filteredTransakcje]);

  // Klik w tę samą kategorię drugi raz zdejmuje filtr (toggle)
  const toggleCategory = (name) =>
    setSelectedCategory(prev => (prev === name ? null : name));

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    toggleCategory,
    clearFilters,
    sortedTransakcje,
    filteredTransakcje,
    groupedByDay,
  };
}
