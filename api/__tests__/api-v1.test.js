/**
 * Testy REST API /api/v1/* — routing, autoryzacja, walidacja,
 * izolacja gospodarstw (household) i ochrona przed mass assignment.
 *
 * Klient Supabase jest mockowany — testy sprawdzają kontrakt HTTP oraz to,
 * jakie zapytania API buduje (w szczególności jawne filtry household_id).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const HOUSEHOLD_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_ID = '11111111-2222-3333-4444-555555555555';
const ROW_ID = '99999999-8888-7777-6666-555555555555';

// Stan mocka konfigurowany per test
const state = {
  user: null,
  profile: null,
  tables: {},
  chains: {},
};

function makeChain(table) {
  const response = () => state.tables[table] ?? { data: [], error: null, count: 0 };
  const chain = { calls: [] };
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'gte', 'lt', 'lte', 'is', 'order'];
  for (const m of methods) {
    chain[m] = vi.fn((...args) => {
      chain.calls.push([m, ...args]);
      return chain;
    });
  }
  chain.range = vi.fn(() => Promise.resolve(response()));
  chain.single = vi.fn(() => Promise.resolve(response()));
  chain.maybeSingle = vi.fn(() => Promise.resolve(response()));
  chain.then = (onFulfilled, onRejected) => Promise.resolve(response()).then(onFulfilled, onRejected);
  return chain;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve(
          state.user
            ? { data: { user: state.user }, error: null }
            : { data: { user: null }, error: { message: 'invalid token' } }
        )
      ),
    },
    from: vi.fn(table => {
      const chain = makeChain(table);
      state.chains[table] = chain;
      return chain;
    }),
  })),
}));

let handler;

beforeAll(async () => {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  handler = (await import('../v1/[...route].js')).default;
});

beforeEach(() => {
  state.user = { id: USER_ID, email: 'test@example.com' };
  state.profile = { household_id: HOUSEHOLD_ID, display_name: 'Test', email: 'test@example.com' };
  state.tables = {
    profiles: { data: state.profile, error: null },
  };
  state.chains = {};
});

function mockReq({ method = 'GET', route = [], query = {}, body, token = 'valid-token' } = {}) {
  return {
    method,
    query: { ...query, route },
    body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

function mockRes() {
  const res = { statusCode: null, headers: {}, body: undefined };
  res.setHeader = vi.fn((k, v) => { res.headers[k] = v; });
  res.status = vi.fn(code => { res.statusCode = code; return res; });
  res.json = vi.fn(payload => { res.body = payload; return res; });
  res.end = vi.fn(() => res);
  return res;
}

async function call(reqOpts) {
  const req = mockReq(reqOpts);
  const res = mockRes();
  await handler(req, res);
  return res;
}

// ── AUTORYZACJA ─────────────────────────────────────────────────────────────

describe('autoryzacja', () => {
  it('zwraca 401 bez nagłówka Authorization', async () => {
    const res = await call({ route: ['transakcje'], token: null });
    expect(res.statusCode).toBe(401);
  });

  it('zwraca 401 dla nieważnego tokenu', async () => {
    state.user = null;
    const res = await call({ route: ['transakcje'] });
    expect(res.statusCode).toBe(401);
  });

  it('zwraca 403 gdy profil nie ma przypisanego gospodarstwa', async () => {
    state.tables.profiles = { data: { household_id: null, display_name: 'X' }, error: null };
    const res = await call({ route: ['transakcje'] });
    expect(res.statusCode).toBe(403);
  });

  it('wymaga autoryzacji także dla nieznanych ścieżek (auth przed routingiem)', async () => {
    const res = await call({ route: ['nieistniejacy-zasob'], token: null });
    expect(res.statusCode).toBe(401);
  });

  it('ustawia Cache-Control: no-store na każdej odpowiedzi', async () => {
    const res = await call({ route: ['transakcje'], token: null });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
});

// ── ROUTING ─────────────────────────────────────────────────────────────────

describe('routing', () => {
  it('zwraca 404 dla nieznanego zasobu', async () => {
    const res = await call({ route: ['faktury'] });
    expect(res.statusCode).toBe(404);
  });

  it('zwraca 404 dla zbyt głębokiej ścieżki', async () => {
    const res = await call({ route: ['transakcje', ROW_ID, 'extra'] });
    expect(res.statusCode).toBe(404);
  });

  it('zwraca 405 z nagłówkiem Allow dla niedozwolonej metody na kolekcji', async () => {
    const res = await call({ method: 'DELETE', route: ['transakcje'] });
    expect(res.statusCode).toBe(405);
    expect(res.headers['Allow']).toBe('GET, POST');
  });

  it('zwraca 400 dla id niebędącego UUID', async () => {
    const res = await call({ route: ['transakcje', 'abc'] });
    expect(res.statusCode).toBe(400);
  });
});

// ── IZOLACJA GOSPODARSTW ────────────────────────────────────────────────────

describe('izolacja household', () => {
  it('lista transakcji filtruje po household_id z profilu', async () => {
    state.tables.transakcje = { data: [], error: null, count: 0 };
    const res = await call({ route: ['transakcje'] });
    expect(res.statusCode).toBe(200);
    expect(state.chains.transakcje.calls).toContainEqual(['eq', 'household_id', HOUSEHOLD_ID]);
  });

  it('POST ignoruje household_id z body — rekord dostaje household z profilu (mass assignment)', async () => {
    state.tables.transakcje = { data: [{ id: ROW_ID }], error: null };
    const res = await call({
      method: 'POST',
      route: ['transakcje'],
      body: {
        data: '2026-07-01', typ: 'Wydatek', kwota: 50, kategoria: 'Jedzenie',
        household_id: 'ffffffff-0000-0000-0000-000000000000',
        id: 'ffffffff-0000-0000-0000-000000000001',
      },
    });
    expect(res.statusCode).toBe(201);
    const [, inserted] = state.chains.transakcje.calls.find(c => c[0] === 'insert');
    expect(inserted[0].household_id).toBe(HOUSEHOLD_ID);
    expect(inserted[0].id).toBeUndefined();
  });

  it('UPDATE zawsze filtruje po household_id (nie da się nadpisać cudzego rekordu)', async () => {
    state.tables.transakcje = { data: { id: ROW_ID }, error: null };
    await call({
      method: 'PATCH',
      route: ['transakcje', ROW_ID],
      body: { kwota: 99 },
    });
    expect(state.chains.transakcje.calls).toContainEqual(['eq', 'household_id', HOUSEHOLD_ID]);
  });

  it('DELETE rekordu spoza gospodarstwa zwraca 404 (bez wycieku informacji)', async () => {
    state.tables.osoby = { data: [], error: null };
    const res = await call({ method: 'DELETE', route: ['osoby', ROW_ID] });
    expect(res.statusCode).toBe(404);
    expect(state.chains.osoby.calls).toContainEqual(['eq', 'household_id', HOUSEHOLD_ID]);
  });
});

// ── WALIDACJA ───────────────────────────────────────────────────────────────

describe('walidacja transakcji', () => {
  it('odrzuca transakcję bez wymaganych pól', async () => {
    const res = await call({ method: 'POST', route: ['transakcje'], body: { kwota: 10 } });
    expect(res.statusCode).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.stringContaining('"data"'),
      expect.stringContaining('"typ"'),
      expect.stringContaining('"kategoria"'),
    ]));
  });

  it('odrzuca nieprawidłowy typ i kwotę zero', async () => {
    const res = await call({
      method: 'POST',
      route: ['transakcje'],
      body: { data: '2026-07-01', typ: 'Zakup', kwota: 0, kategoria: 'X' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('odrzuca nieistniejącą datę kalendarzową', async () => {
    const res = await call({
      method: 'POST',
      route: ['transakcje'],
      body: { data: '2026-02-30', typ: 'Wydatek', kwota: 10, kategoria: 'X' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('normalizuje kwotę do wartości bezwzględnej', async () => {
    state.tables.transakcje = { data: [{ id: ROW_ID }], error: null };
    await call({
      method: 'POST',
      route: ['transakcje'],
      body: { data: '2026-07-01', typ: 'Wydatek', kwota: -123.45, kategoria: 'X' },
    });
    const [, inserted] = state.chains.transakcje.calls.find(c => c[0] === 'insert');
    expect(inserted[0].kwota).toBe(123.45);
  });

  it('odrzuca batch większy niż limit', async () => {
    const tx = { data: '2026-07-01', typ: 'Wydatek', kwota: 1, kategoria: 'X' };
    const res = await call({
      method: 'POST',
      route: ['transakcje'],
      body: Array.from({ length: 501 }, () => ({ ...tx })),
    });
    expect(res.statusCode).toBe(413);
  });

  it('wskazuje indeks błędnego rekordu w batchu', async () => {
    const ok = { data: '2026-07-01', typ: 'Wydatek', kwota: 1, kategoria: 'X' };
    const res = await call({
      method: 'POST',
      route: ['transakcje'],
      body: [ok, { ...ok, kwota: 'zła' }],
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('rekord 1');
  });

  it('PATCH z pustym zestawem pól zwraca 400', async () => {
    const res = await call({
      method: 'PATCH',
      route: ['transakcje', ROW_ID],
      body: { nieznane_pole: 1 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('walidacja budżetów', () => {
  it('wymaga miesiaca dla zakresu monthly', async () => {
    const res = await call({
      method: 'POST',
      route: ['budzety'],
      body: { kategoria: 'Jedzenie', limit_kwota: 1000, zakres: 'monthly', rok: 2026 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('dla zakresu yearly wymusza miesiac = null', async () => {
    state.tables.budzety = { data: [{ id: ROW_ID }], error: null };
    await call({
      method: 'POST',
      route: ['budzety'],
      body: { kategoria: 'Jedzenie', limit_kwota: 1000, zakres: 'yearly', rok: 2026, miesiac: 5 },
    });
    const [, inserted] = state.chains.budzety.calls.find(c => c[0] === 'insert');
    expect(inserted[0].miesiac).toBeNull();
  });

  it('duplikat budżetu (unikalny indeks) zwraca 409', async () => {
    state.tables.budzety = { data: null, error: { code: '23505', message: 'duplicate key' } };
    const res = await call({
      method: 'POST',
      route: ['budzety'],
      body: { kategoria: 'Jedzenie', limit_kwota: 1000, zakres: 'monthly', rok: 2026, miesiac: 7 },
    });
    expect(res.statusCode).toBe(409);
  });
});

// ── FILTRY LIST ─────────────────────────────────────────────────────────────

describe('filtry list', () => {
  it('miesiac bez roku zwraca 400', async () => {
    const res = await call({ route: ['transakcje'], query: { miesiac: '7' } });
    expect(res.statusCode).toBe(400);
  });

  it('rok+miesiac budują zakres dat', async () => {
    state.tables.transakcje = { data: [], error: null, count: 0 };
    await call({ route: ['transakcje'], query: { rok: '2026', miesiac: '12' } });
    const calls = state.chains.transakcje.calls;
    expect(calls).toContainEqual(['gte', 'data', '2026-12-01']);
    expect(calls).toContainEqual(['lt', 'data', '2027-01-01']);
  });

  it('nieprawidłowy parametr typ zwraca 400', async () => {
    const res = await call({ route: ['transakcje'], query: { typ: 'Inne' } });
    expect(res.statusCode).toBe(400);
  });

  it('paginacja jest ograniczona do maksymalnego limitu', async () => {
    state.tables.transakcje = { data: [], error: null, count: 0 };
    const res = await call({ route: ['transakcje'], query: { limit: '99999', offset: '-5' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.limit).toBe(500);
    expect(res.body.offset).toBe(0);
    expect(state.chains.transakcje.range).toHaveBeenCalledWith(0, 499);
  });
});

// ── OPERACJE CRUD ───────────────────────────────────────────────────────────

describe('operacje CRUD', () => {
  it('GET /me zwraca użytkownika, profil i gospodarstwo', async () => {
    state.tables.households = { data: { id: HOUSEHOLD_ID, name: 'Dom' }, error: null };
    const res = await call({ route: ['me'] });
    expect(res.statusCode).toBe(200);
    expect(res.body.user.id).toBe(USER_ID);
    expect(res.body.household).toEqual({ id: HOUSEHOLD_ID, name: 'Dom' });
  });

  it('GET rekordu, który nie istnieje, zwraca 404', async () => {
    state.tables.transakcje = { data: null, error: null };
    const res = await call({ route: ['transakcje', ROW_ID] });
    expect(res.statusCode).toBe(404);
  });

  it('POST osoby zwraca 201 z utworzonym rekordem', async () => {
    state.tables.osoby = { data: [{ id: ROW_ID, nazwa: 'Ania' }], error: null };
    const res = await call({ method: 'POST', route: ['osoby'], body: { nazwa: '  Ania  ' } });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ id: ROW_ID, nazwa: 'Ania' });
    const [, inserted] = state.chains.osoby.calls.find(c => c[0] === 'insert');
    expect(inserted[0].nazwa).toBe('Ania'); // przycięte spacje
  });

  it('DELETE istniejącego rekordu zwraca 204 bez body', async () => {
    state.tables.osoby = { data: [{ id: ROW_ID }], error: null };
    const res = await call({ method: 'DELETE', route: ['osoby', ROW_ID] });
    expect(res.statusCode).toBe(204);
    expect(res.end).toHaveBeenCalled();
  });

  it('PATCH kategorii aktualizuje tylko przysłane pola', async () => {
    state.tables.kategorie = { data: { id: ROW_ID, typ: 'Wydatek', kategoria: 'Nowa', podkategoria: null }, error: null };
    const res = await call({
      method: 'PATCH',
      route: ['kategorie', ROW_ID],
      body: { kategoria: 'Nowa' },
    });
    expect(res.statusCode).toBe(200);
    const [, updated] = state.chains.kategorie.calls.find(c => c[0] === 'update');
    expect(updated).toEqual({ kategoria: 'Nowa' });
  });

  it('wygasła sesja (PGRST301) daje 401', async () => {
    state.tables.transakcje = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
    const res = await call({ route: ['transakcje'] });
    expect(res.statusCode).toBe(401);
  });
});
