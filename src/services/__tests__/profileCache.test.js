import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = { userId: 'u1', profileCalls: 0, fail: false };

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({
        data: { session: state.userId ? { user: { id: state.userId } } : null },
        error: null,
      }),
    },
    from: () => {
      const chain = {
        select: () => chain,
        eq: (_col, id) => { chain.id = id; return chain; },
        single: () => {
          state.profileCalls++;
          if (state.fail) return Promise.resolve({ data: null, error: { message: 'network' } });
          return Promise.resolve({ data: { id: chain.id, household_id: `hh-${chain.id}` }, error: null });
        },
      };
      return chain;
    },
  },
}));

import { getUserProfile, clearProfileCache } from '../api';

describe('getUserProfile — cache profilu', () => {
  beforeEach(() => {
    clearProfileCache();
    Object.assign(state, { userId: 'u1', profileCalls: 0, fail: false });
  });

  it('równoległe i kolejne wywołania dzielą jedno zapytanie', async () => {
    const [a, b] = await Promise.all([getUserProfile(), getUserProfile()]);
    await getUserProfile();
    expect(a.household_id).toBe('hh-u1');
    expect(b).toBe(a);
    expect(state.profileCalls).toBe(1);
  });

  it('inny użytkownik w sesji → nowy profil, nie cudzy z cache', async () => {
    await getUserProfile();
    state.userId = 'u2';
    const p = await getUserProfile();
    expect(p.household_id).toBe('hh-u2');
    expect(state.profileCalls).toBe(2);
  });

  it('błąd nie zostaje zapamiętany', async () => {
    state.fail = true;
    await expect(getUserProfile()).rejects.toBeTruthy();
    state.fail = false;
    await expect(getUserProfile()).resolves.toMatchObject({ household_id: 'hh-u1' });
    expect(state.profileCalls).toBe(2);
  });

  it('brak sesji → błąd i wyczyszczony cache', async () => {
    await getUserProfile();
    state.userId = null;
    await expect(getUserProfile()).rejects.toThrow('nie zalogowany');
    state.userId = 'u1';
    await getUserProfile();
    expect(state.profileCalls).toBe(2);
  });
});
