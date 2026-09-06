/**
 * Testy setBudget() — kontrakt upsertu budżetów.
 *
 * Sedno: lista kolumn w `onConflict` musi być identyczna z ograniczeniem
 * `budzety_unique_budget` w bazie (migration/013_budzety_unique_nulls_not_distinct.sql).
 * Gdy jedno rozjedzie się z drugim, PostgREST nie dopasuje indeksu arbitrażowego,
 * upsert po cichu degeneruje się do INSERT-u i wraca błąd z issue #113 —
 * duplikaty budżetów wspólnych (osoba = NULL) i rocznych (miesiac = NULL).
 *
 * Osobny plik od api.test.js, bo tamtejszy mock zwraca świeży obiekt przy każdym
 * wywołaniu supabase.from() — nie da się na nim asertować argumentów upsert.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const HOUSEHOLD_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_ID = '11111111-2222-3333-4444-555555555555';

// Kolumny ograniczenia budzety_unique_budget — trzymaj zgodne z migracją 013.
const ONCONFLICT = 'household_id,kategoria,osoba,zakres,rok,miesiac';

const state = { chains: {} };

function makeChain(table) {
  const response = () =>
    table === 'profiles'
      ? { data: { id: USER_ID, household_id: HOUSEHOLD_ID }, error: null }
      : { data: null, error: null };

  const chain = { calls: [] };
  for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'is', 'order']) {
    chain[m] = vi.fn((...args) => {
      chain.calls.push([m, ...args]);
      return chain;
    });
  }
  chain.single = vi.fn(() => Promise.resolve(response()));
  chain.maybeSingle = vi.fn(() => Promise.resolve(response()));
  chain.then = (onFulfilled, onRejected) =>
    Promise.resolve(response()).then(onFulfilled, onRejected);
  return chain;
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: USER_ID } }, error: null })
      ),
    },
    from: vi.fn(table => {
      const chain = makeChain(table);
      state.chains[table] = chain;
      return chain;
    }),
  },
}));

let setBudget;

beforeEach(async () => {
  state.chains = {};
  vi.clearAllMocks();
  ({ setBudget } = await import('../api.js'));
});

function upsertCall() {
  const call = state.chains.budzety.calls.find(c => c[0] === 'upsert');
  expect(call, 'setBudget powinien wywołać upsert na tabeli budzety').toBeDefined();
  const [, record, options] = call;
  return { record, options };
}

describe('setBudget — upsert budżetów', () => {
  it('budżet roczny wspólny zapisuje osoba/miesiac jako NULL i używa pełnego onConflict', async () => {
    await setBudget({ kategoria: 'Jedzenie', limit: 3900, rok: '2027', osoba: '', zakres: 'yearly' });

    const { record, options } = upsertCall();
    expect(record).toMatchObject({
      household_id: HOUSEHOLD_ID,
      kategoria: 'Jedzenie',
      limit_kwota: 3900,
      rok: 2027,
      zakres: 'yearly',
    });
    // Oba NULL-e naraz — przypadek, w którym stare ograniczenie NULLS DISTINCT
    // nigdy nie wykrywało konfliktu.
    expect(record.osoba).toBeNull();
    expect(record.miesiac).toBeNull();
    expect(options.onConflict).toBe(ONCONFLICT);
  });

  it('budżet miesięczny zapisuje miesiac jako liczbę i ten sam onConflict', async () => {
    await setBudget({
      kategoria: 'Transport',
      limit: 500,
      rok: 2027,
      miesiac: '3',
      osoba: 'Paweł',
      zakres: 'monthly',
    });

    const { record, options } = upsertCall();
    expect(record.miesiac).toBe(3);
    expect(record.osoba).toBe('Paweł');
    expect(options.onConflict).toBe(ONCONFLICT);
  });

  it('onConflict wymienia dokładnie kolumny ograniczenia budzety_unique_budget', async () => {
    await setBudget({ kategoria: 'Jedzenie', limit: 100, rok: 2027, osoba: '', zakres: 'yearly' });

    const { options } = upsertCall();
    // Kolejność nieistotna dla PostgREST, ale zestaw kolumn musi się zgadzać
    // co do jednej — inaczej indeks arbitrażowy nie zostanie dopasowany.
    expect(options.onConflict.split(',').sort()).toEqual(
      ['household_id', 'kategoria', 'miesiac', 'osoba', 'rok', 'zakres']
    );
  });
});
