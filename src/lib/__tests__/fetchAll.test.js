import { describe, it, expect, vi } from 'vitest';
import { fetchAll } from '../fetchAll';

// Atrapa serwera PostgREST: zwraca wycinek `rows`, ale nie więcej niż maxRows.
function fakeServer(rows, maxRows = 1000) {
  const calls = [];
  const build = vi.fn(() => ({
    range(from, to) {
      calls.push([from, to]);
      const end = Math.min(to + 1, from + maxRows, rows.length);
      return Promise.resolve({ data: rows.slice(from, end), error: null, count: rows.length });
    },
  }));
  return { build, calls };
}

const make = n => Array.from({ length: n }, (_, i) => ({ id: i }));

describe('fetchAll', () => {
  it('jedna strona, gdy wierszy jest mniej niż rozmiar strony', async () => {
    const { build, calls } = fakeServer(make(5));
    const { data, error } = await fetchAll(build, { pageSize: 10 });
    expect(error).toBeNull();
    expect(data).toHaveLength(5);
    expect(calls).toEqual([[0, 9]]);
  });

  it('pobiera wszystkie strony powyżej limitu (np. 2500 przy 1000)', async () => {
    const { build, calls } = fakeServer(make(2500));
    const { data } = await fetchAll(build);
    expect(data.map(r => r.id)).toEqual(make(2500).map(r => r.id));
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('nie gubi danych, gdy serwer ma max_rows mniejsze niż strona', async () => {
    const { build } = fakeServer(make(1200), 500);
    const { data } = await fetchAll(build, { pageSize: 1000 });
    expect(data).toHaveLength(1200);
    expect(new Set(data.map(r => r.id)).size).toBe(1200);
  });

  it('pusta tabela', async () => {
    const { build } = fakeServer([]);
    const { data } = await fetchAll(build);
    expect(data).toEqual([]);
  });

  it('zwraca błąd bez częściowych danych', async () => {
    const err = { code: 'PGRST301', message: 'JWT expired' };
    const build = () => ({ range: () => Promise.resolve({ data: null, error: err, count: null }) });
    expect(await fetchAll(build)).toEqual({ data: null, error: err });
  });
});
