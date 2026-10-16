// Data format specyficzny dla UI (notacja kropkowa pl-PL, np. "13.02.2026").
// Różni się od utils/calculations.formatDate (slashes) używanego w testach
// i kontekstach nie-UI — dlatego celowo nie konsolidujemy.
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Nagłówek grupy dziennej na liście transakcji, np. "czwartek, 10 lipca"
export const formatDayHeader = (dateString) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
};
