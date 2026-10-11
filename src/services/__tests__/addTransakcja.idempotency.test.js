import { describe, it, expect, beforeEach, vi } from 'vitest';

const insert = vi.fn();
let insertResult;

vi.mock('../../lib/supabase', () => {
  const profileChain = {
    select: () => profileChain,
    eq: () => profileChain,
    single: () => Promise.resolve({ data: { id: 'u1', household_id: 'h1' }, error: null }),
  };
  const txChain = {
    insert: (row) => { insert(row); return txChain; },
    select: () => txChain,
    single: () => Promise.resolve(insertResult),
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
      from: (table) => (table === 'profiles' ? profileChain : txChain),
    },
  };
});

import { addTransakcja } from '../api';

const tx = { data: '2026-10-01', typ: 'Wydatek', kwota: -12.5, kategoria: 'Jedzenie', osoba: 'A' };

describe('addTransakcja — idempotencja kolejki offline', () => {
  beforeEach(() => {
    insert.mockClear();
  });

  it('wysyła id nadane przez klienta', async () => {
    insertResult = { data: { id: 'c-uuid' }, error: null };
    await addTransakcja({ ...tx, id: 'c-uuid' });
    expect(insert.mock.calls[0][0]).toMatchObject({ id: 'c-uuid', household_id: 'h1', kwota: 12.5 });
  });

  it('bez id nie ustawia klucza (baza nadaje własne)', async () => {
    insertResult = { data: { id: 'db-uuid' }, error: null };
    const res = await addTransakcja(tx);
    expect(insert.mock.calls[0][0]).not.toHaveProperty('id');
    expect(res).toEqual({ success: true, id: 'db-uuid' });
  });

  it('konflikt klucza przy ponowieniu = już zapisane, nie błąd', async () => {
    insertResult = { data: null, error: { code: '23505', message: 'duplicate key' } };
    const res = await addTransakcja({ ...tx, id: 'c-uuid' });
    expect(res).toEqual({ success: true, id: 'c-uuid', duplicate: true });
  });

  it('konflikt bez id klienta nadal jest błędem', async () => {
    insertResult = { data: null, error: { code: '23505', message: 'duplicate key' } };
    await expect(addTransakcja(tx)).rejects.toMatchObject({ code: '23505' });
  });
});
