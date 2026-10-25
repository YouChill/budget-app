import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Klient HMAC rachunków (#130): endpoint niedostępny nie może blokować importu.

const getSession = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession }, from: vi.fn() } }));

import { hmacRachunkow, zHmacAliasow } from '../api';

const NRB = '61109010140000071219812874';
const H = (c) => c.repeat(64);

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  globalThis.fetch = vi.fn();
});
afterEach(() => { delete globalThis.fetch; });

describe('hmacRachunkow', () => {
  it('wysyła rachunki z tokenem sesji i zwraca HMAC w kolejności', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ hmac: [H('a'), null] }) });
    expect(await hmacRachunkow([NRB, '123'])).toEqual([H('a'), null]);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('/api/v1/rachunki/hmac');
    expect(opts.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(opts.body)).toEqual({ rachunki: [NRB, '123'] });
  });

  it('dzieli na partie po 2000', async () => {
    fetch.mockImplementation(async (_u, o) => ({ ok: true, json: async () => ({ hmac: JSON.parse(o.body).rachunki.map(() => H('c')) }) }));
    const wynik = await hmacRachunkow(Array(2500).fill(NRB));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(wynik).toHaveLength(2500);
    expect(wynik.every(h => h === H('c'))).toBe(true);
  });

  it('503 / brak sieci / brak sesji → same null', async () => {
    fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    expect(await hmacRachunkow([NRB, NRB])).toEqual([null, null]);
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await hmacRachunkow([NRB])).toEqual([null]);
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await hmacRachunkow([NRB])).toEqual([null]);
  });
});

describe('zHmacAliasow', () => {
  it('haszuje tylko kanoniczne aliasy rachunków', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ hmac: [H('d')] }) });
    const aliasy = [
      { wzorzec: NRB, typ_wzorca: 'rachunek', kontrahent: 'play' },
      { wzorzec: '7777', typ_wzorca: 'rachunek', kontrahent: 'krotki' },
      { wzorzec: 'APPLE.COM/BILL', typ_wzorca: 'opis', kontrahent: 'apple' },
    ];
    const wynik = await zHmacAliasow(aliasy);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ rachunki: [NRB] });
    expect(wynik.map(a => a.wzorzecHmac ?? null)).toEqual([H('d'), null, null]);
  });
});
