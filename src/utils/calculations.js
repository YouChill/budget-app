/**
 * Zaokrągla kwotę do groszy (2 miejsc). Sumy pieniężne liczone na floatach
 * potrafią zbierać dryf rzędu 0,01 zł przy wielu składnikach — zaokrąglamy w
 * jednym miejscu, żeby wyświetlane sumy były spójne z zapisem w bazie (numeric).
 * @param {number} value
 * @returns {number}
 */
export const roundTo2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Formatuje kwotę do formatu polskiego PLN
 * @param {number} amount - Kwota do sformatowania
 * @returns {string} Sformatowana kwota (np. "1 234,56 zł")
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formatuje datę do formatu polskiego
 * @param {string|Date} dateString - Data jako string ISO lub obiekt Date
 * @returns {string} Sformatowana data (np. "13/02/2026")
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Nazwy miesięcy w języku polskim
 */
export const MONTH_NAMES = [
  '', // 0 - nieużywane
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

/**
 * Zwraca nazwę miesiąca
 * @param {number} month - Numer miesiąca (1-12)
 * @param {number} year - Rok
 * @returns {string} Nazwa miesiąca z rokiem (np. "Luty 2026")
 */
export const getMonthName = (month, year) => {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('pl-PL', { 
    month: 'long', 
    year: 'numeric' 
  });
};

/**
 * Oblicza sumę przychodów z listy transakcji
 * @param {Array} transakcje - Lista transakcji
 * @returns {number} Suma przychodów
 */
export const calculateIncome = (transakcje = []) => {
  return roundTo2(
    transakcje
      .filter(t => t.typ === 'Przychód')
      .reduce((sum, t) => sum + (parseFloat(t.kwota) || 0), 0)
  );
};

/**
 * Oblicza sumę wydatków z listy transakcji
 * @param {Array} transakcje - Lista transakcji
 * @returns {number} Suma wydatków
 */
export const calculateExpenses = (transakcje = []) => {
  return roundTo2(
    transakcje
      .filter(t => t.typ === 'Wydatek')
      .reduce((sum, t) => sum + (parseFloat(t.kwota) || 0), 0)
  );
};

/**
 * Oblicza bilans (przychody - wydatki)
 * @param {Array} transakcje - Lista transakcji
 * @returns {number} Bilans
 */
export const calculateBalance = (transakcje = []) => {
  const income = calculateIncome(transakcje);
  const expenses = calculateExpenses(transakcje);
  return roundTo2(income - expenses);
};

/**
 * Zmienia miesiąc o podaną wartość
 * @param {number} month - Aktualny miesiąc (1-12)
 * @param {number} year - Aktualny rok
 * @param {number} delta - Zmiana miesiąca
 * @returns {{month: number, year: number}} Nowy miesiąc i rok
 */
export const changeMonth = (month, year, delta) => {
  let newMonth = month + delta;
  let newYear = year;

  // Obsługuj wielokrotne przejścia lat
  while (newMonth < 1) {
    newMonth += 12;
    newYear--;
  }
  while (newMonth > 12) {
    newMonth -= 12;
    newYear++;
  }

  return { month: newMonth, year: newYear };
};

/**
 * Zwraca bieżący miesiąc i rok
 * @returns {{month: number, year: number}} Bieżący miesiąc i rok
 */
export const getCurrentMonth = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

/**
 * Sortuje transakcje od najnowszych do najstarszych
 * @param {Array} transakcje - Lista transakcji
 * @returns {Array} Posortowana lista transakcji
 */
export const sortTransactionsByDate = (transakcje = []) => {
  return [...transakcje].sort((a, b) => {
    const dateA = new Date(a.data);
    const dateB = new Date(b.data);
    return dateB - dateA;
  });
};

// ═══════════════════════════════════════════
// YEARLY SUMMARY HELPERS
// ═══════════════════════════════════════════

export const MONTHS_PL_SHORT = [
  'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze',
  'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru',
];

/**
 * Agreguje transakcje wg miesiąca (przychody / wydatki)
 * @param {Array} transakcje - Lista transakcji z danego roku
 * @returns {Array} 12-elementowa tablica { month, przychody, wydatki }
 */
export const aggregateByMonth = (transakcje = []) => {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: MONTHS_PL_SHORT[i],
    przychody: 0,
    wydatki: 0,
  }));

  transakcje.forEach(t => {
    const m = new Date(t.data).getMonth();
    const kwota = parseFloat(t.kwota) || 0;
    if (t.typ === 'Przychód') months[m].przychody += kwota;
    else months[m].wydatki += kwota;
  });

  return months;
};

/**
 * Agreguje transakcje wg kategorii
 * @param {Array} transakcje - Lista transakcji
 * @param {string} typ - 'Wydatek' lub 'Przychód'
 * @returns {Array} Tablica { name, value } posortowana malejąco
 */
export const aggregateByCategory = (transakcje = [], typ = 'Wydatek') => {
  const grouped = {};

  transakcje
    .filter(t => t.typ === typ)
    .forEach(t => {
      const kat = t.kategoria || 'Inne';
      grouped[kat] = (grouped[kat] || 0) + (parseFloat(t.kwota) || 0);
    });

  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Agreguje transakcje wg osoby
 * @param {Array} transakcje - Lista transakcji
 * @returns {Array} Tablica { name, przychody, wydatki, bilans }
 */
export const aggregateByPerson = (transakcje = []) => {
  const grouped = {};

  transakcje.forEach(t => {
    const osoba = t.osoba || 'Nieprzypisane';
    if (!grouped[osoba]) grouped[osoba] = { przychody: 0, wydatki: 0 };
    const kwota = parseFloat(t.kwota) || 0;
    if (t.typ === 'Przychód') grouped[osoba].przychody += kwota;
    else grouped[osoba].wydatki += kwota;
  });

  return Object.entries(grouped)
    .map(([name, data]) => ({
      name,
      przychody: Math.round(data.przychody * 100) / 100,
      wydatki: Math.round(data.wydatki * 100) / 100,
      bilans: Math.round((data.przychody - data.wydatki) * 100) / 100,
    }))
    .sort((a, b) => b.wydatki - a.wydatki);
};

/**
 * Oblicza zmianę rok do roku
 * @param {number} currentValue - Wartość bieżącego roku
 * @param {number} previousValue - Wartość poprzedniego roku
 * @returns {{ change: number, percent: number|null }}
 */
export const calculateYoY = (currentValue, previousValue) => {
  const change = currentValue - previousValue;
  const percent = previousValue !== 0
    ? ((change / Math.abs(previousValue)) * 100)
    : null;
  return { change, percent };
};
