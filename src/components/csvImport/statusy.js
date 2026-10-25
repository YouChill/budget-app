// używane przez widok Do rozliczenia (#132)
// ─── Grupy w podglądzie importu ───────────────────────────────────────────────
export const FILTRY_STATUSU = [
  { id: 'wszystkie', label: 'Wszystkie' },
  { id: 'nowa', label: 'Nowe' },
  { id: 'polaczona', label: 'Pasuje do faktury' },
  { id: 'do_weryfikacji', label: 'Do weryfikacji' },
  { id: 'zaksiegowana', label: 'Już zaksięgowane' },
];

export const pasujeDoFiltra = (tx, filtr) =>
  filtr === 'wszystkie' || (tx._dedup?.status ?? 'nowa') === filtr;
