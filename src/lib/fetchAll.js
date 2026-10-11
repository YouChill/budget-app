// PostgREST (Supabase) zwraca najwyżej `max_rows` wierszy na zapytanie —
// domyślnie 1000 — i NIE zgłasza błędu przy obcięciu. Zapytania bez limitu
// (cały rok, okno parowania importu) muszą więc stronicować.
//
// Przyjmuje fabrykę, bo builder supabase-js po wykonaniu nie nadaje się do
// ponownego użycia. Fabryka musi ustawić deterministyczne sortowanie
// (np. data + id), inaczej strony mogą się nakładać.
//
// Koniec ustalamy z `count: 'exact'`, a nie z długości strony: serwer może mieć
// max_rows mniejsze niż PAGE_SIZE, wtedy "krótka" strona nie oznacza końca.

export const PAGE_SIZE = 1000;

export async function fetchAll(buildQuery, { pageSize = PAGE_SIZE } = {}) {
  const rows = [];
  let total = null;

  for (;;) {
    const from = rows.length;
    const { data, error, count } = await buildQuery().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    if (total === null) total = count ?? null;

    rows.push(...(data ?? []));
    if (!data || data.length === 0) break;
    if (total !== null ? rows.length >= total : data.length < pageSize) break;
  }

  return { data: rows, error: null };
}
