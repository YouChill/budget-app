import { supabase } from '../lib/supabase';

// Fallback dla backward compatibility (dla development bez auth)
const FALLBACK_HOUSEHOLD_ID = import.meta.env.VITE_HOUSEHOLD_ID;

// ═══════════════════════════════════════════
// PROFILE & HOUSEHOLD FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Pobiera profil zalogowanego użytkownika wraz z household_id
 */
export async function getUserProfile() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('Użytkownik nie zalogowany');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, household_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    // Profil nie istnieje — twórz go
    if (profileError.code === 'PGRST116') {
      // Spróbuj automatycznie stworzyć profil z ostatnim household
      const { data: households } = await supabase
        .from('households')
        .select('id')
        .limit(1);

      if (households && households.length > 0) {
        const { data: created } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            display_name: user.user_metadata?.name || user.email,
            household_id: households[0].id,
          })
          .select('id, email, display_name, household_id')
          .single();

        return created;
      }
    }
    throw profileError;
  }

  if (!profile.household_id) {
    throw new Error('Profil użytkownika nie ma przypisanego gospodarstwa (household)');
  }

  return profile;
}

/**
 * Przydziel użytkownika do gospodarstwa (household) — admin operation
 */
export async function assignUserToHousehold(userId, householdId) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ household_id: householdId })
    .eq('id', userId)
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * Pobiera household_id zalogowanego użytkownika
 * Falls back do VITE_HOUSEHOLD_ID dla backward compatibility
 */
async function getHouseholdId() {
  try {
    const profile = await getUserProfile();
    return profile.household_id;
  } catch (err) {
    console.warn('Nie udało się pobrać household_id z profilu, używam fallback', err);
    if (FALLBACK_HOUSEHOLD_ID) {
      return FALLBACK_HOUSEHOLD_ID;
    }
    throw new Error('Brak household_id — zaloguj się lub ustaw VITE_HOUSEHOLD_ID');
  }
}

/**
 * Obsługuje błędy 401/403 — redirect na login
 */
function handleAuthError(error) {
  if (error?.status === 401 || error?.status === 403) {
    // Trigger logout by clearing auth state
    localStorage.removeItem('budget_auth_token');
    localStorage.removeItem('budget_auth_user');
    window.location.href = '/';
  }
  throw error;
}

// ═══════════════════════════════════════════
// TRANSAKCJE
// ═══════════════════════════════════════════

export async function getTransakcje(miesiac, rok) {
  const householdId = await getHouseholdId();
  const startDate = `${rok}-${String(miesiac).padStart(2, '0')}-01`;
  const endDate = miesiac === 12
    ? `${rok + 1}-01-01`
    : `${rok}-${String(miesiac + 1).padStart(2, '0')}-01`;

  try {
    const { data, error } = await supabase
      .from('transakcje')
      .select('id, data, typ, kwota, kategoria, podkategoria, osoba, komentarz')
      .eq('household_id', householdId)
      .gte('data', startDate)
      .lt('data', endDate)
      .order('data', { ascending: false });

    if (error) {
      handleAuthError(error);
    }
    return data;
  } catch (err) {
    handleAuthError(err);
  }
}

export async function addTransakcja(transakcja) {
  const householdId = await getHouseholdId();
  try {
    const { data, error } = await supabase
      .from('transakcje')
      .insert({
        household_id: householdId,
        data: transakcja.data,
        typ: transakcja.typ,
        kwota: Math.abs(transakcja.kwota),
        kategoria: transakcja.kategoria,
        podkategoria: transakcja.podkategoria || null,
        osoba: transakcja.osoba,
        komentarz: transakcja.komentarz || null,
      })
      .select('id')
      .single();

    if (error) {
      handleAuthError(error);
    }
    return { success: true, id: data.id };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function updateTransakcja(id, transakcja) {
  const householdId = await getHouseholdId();
  try {
    const { error } = await supabase
      .from('transakcje')
      .update({
        data: transakcja.data,
        typ: transakcja.typ,
        kwota: Math.abs(transakcja.kwota),
        kategoria: transakcja.kategoria,
        podkategoria: transakcja.podkategoria || null,
        osoba: transakcja.osoba,
        komentarz: transakcja.komentarz || null,
      })
      .eq('id', id)
      .eq('household_id', householdId);

    if (error) {
      handleAuthError(error);
    }
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function deleteTransakcja(id) {
  const householdId = await getHouseholdId();
  try {
    const { error } = await supabase
      .from('transakcje')
      .delete()
      .eq('id', id)
      .eq('household_id', householdId);

    if (error) {
      handleAuthError(error);
    }
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function addTransakcjeBatch(transakcje) {
  const householdId = await getHouseholdId();
  const records = transakcje.map(t => {
    const kwota = typeof t.kwota === 'number' ? t.kwota : parseFloat(t.kwota);
    return {
      household_id: householdId,
      data: t.data,
      typ: t.typ || (kwota < 0 ? 'Wydatek' : 'Przychód'),
      kwota: Math.abs(kwota),
      kategoria: t.kategoria,
      podkategoria: t.podkategoria || null,
      osoba: t.osoba || null,
      komentarz: t.komentarz || t.opis || null,
    };
  });

  try {
    const { data, error } = await supabase
      .from('transakcje')
      .insert(records)
      .select('id');

    if (error) {
      handleAuthError(error);
    }
    return { success: true, count: data.length, ids: data.map(d => d.id) };
  } catch (err) {
    handleAuthError(err);
  }
}

// ═══════════════════════════════════════════
// KATEGORIE
// ═══════════════════════════════════════════

export async function getKategorie() {
  const householdId = await getHouseholdId();
  try {
    const { data, error } = await supabase
      .from('kategorie')
      .select('typ, kategoria, podkategoria')
      .eq('household_id', householdId)
      .order('typ')
      .order('kategoria')
      .order('podkategoria');

    if (error) {
      handleAuthError(error);
    }

    // Transform flat rows → nested { Wydatek: { cat: [subcats] }, Przychód: {...} }
    const result = { Wydatek: {}, Przychód: {} };
    for (const row of data) {
      if (!result[row.typ]) result[row.typ] = {};
      if (!result[row.typ][row.kategoria]) result[row.typ][row.kategoria] = [];
      if (row.podkategoria) {
        result[row.typ][row.kategoria].push(row.podkategoria);
      }
    }
    return result;
  } catch (err) {
    handleAuthError(err);
  }
}

export async function addKategoria(typ, kategoria, podkategoria) {
  const householdId = await getHouseholdId();
  try {
    const { error } = await supabase
      .from('kategorie')
      .insert({
        household_id: householdId,
        typ,
        kategoria,
        podkategoria: podkategoria || null,
      });

    if (error) {
      handleAuthError(error);
    }
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function deleteKategoria(typ, kategoria, podkategoria) {
  const householdId = await getHouseholdId();
  try {
    let query = supabase
      .from('kategorie')
      .delete()
      .eq('household_id', householdId)
      .eq('typ', typ)
      .eq('kategoria', kategoria);

    if (podkategoria) {
      query = query.eq('podkategoria', podkategoria);
    }

    const { error } = await query;
    if (error) {
      handleAuthError(error);
    }
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

// ═══════════════════════════════════════════
// OSOBY
// ═══════════════════════════════════════════

export async function getOsoby() {
  const householdId = await getHouseholdId();
  try {
    const { data, error } = await supabase
      .from('osoby')
      .select('nazwa')
      .eq('household_id', householdId)
      .order('nazwa');

    if (error) {
      handleAuthError(error);
    }
    return data.map(o => o.nazwa);
  } catch (err) {
    handleAuthError(err);
  }
}

export async function addOsoba(osoba) {
  const householdId = await getHouseholdId();
  try {
    const { error } = await supabase
      .from('osoby')
      .insert({
        household_id: householdId,
        nazwa: osoba,
      });

    if (error) {
      handleAuthError(error);
    }
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function deleteOsoba(osoba) {
  const householdId = await getHouseholdId();
  try {
    const { error } = await supabase
      .from('osoby')
      .delete()
      .eq('household_id', householdId)
      .eq('nazwa', osoba);

    if (error) {
      handleAuthError(error);
    }
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

// ═══════════════════════════════════════════
// BUDŻETY
// ═══════════════════════════════════════════

function transformBudget(b, zrodlo) {
  return {
    kategoria: b.kategoria,
    limit: b.limit_kwota,
    miesiac: b.miesiac,
    rok: b.rok,
    osoba: b.osoba || '',
    zakres: b.zakres,
    notatki: b.notatki || '',
    zrodlo,
    rocznyLimit: null,
    roczneNotatki: null,
  };
}

export async function getBudgets(miesiac, rok) {
  const householdId = await getHouseholdId();
  try {
    // Get monthly budgets for the specific month
    const { data: monthly, error: monthlyError } = await supabase
      .from('budzety')
      .select('*')
      .eq('household_id', householdId)
      .eq('zakres', 'monthly')
      .eq('miesiac', miesiac)
      .eq('rok', rok);

    if (monthlyError) {
      handleAuthError(monthlyError);
    }

    // Get yearly budgets
    const { data: yearly, error: yearlyError } = await supabase
      .from('budzety')
      .select('*')
      .eq('household_id', householdId)
      .eq('zakres', 'yearly')
      .eq('rok', rok);

    if (yearlyError) {
      handleAuthError(yearlyError);
    }

    // Resolve hierarchy: monthly overrides yearly
    const resolved = [];
    const monthlyByKey = new Map();

    for (const b of monthly) {
      const key = `${b.kategoria}|${b.osoba || ''}`;
      monthlyByKey.set(key, b);
      resolved.push(transformBudget(b, 'monthly'));
    }

    for (const b of yearly) {
      const key = `${b.kategoria}|${b.osoba || ''}`;
      if (!monthlyByKey.has(key)) {
        resolved.push(transformBudget(b, 'yearly'));
      } else {
        // Monthly exists — attach yearly info
        const existing = resolved.find(r =>
          r.kategoria === b.kategoria && (r.osoba || '') === (b.osoba || '') && r.zrodlo === 'monthly'
        );
        if (existing) {
          existing.rocznyLimit = b.limit_kwota;
          existing.roczneNotatki = b.notatki;
        }
      }
    }

    return resolved;
  } catch (err) {
    handleAuthError(err);
  }
}

export async function getAllBudgetsForYear(rok) {
  const householdId = await getHouseholdId();
  try {
    const { data, error } = await supabase
      .from('budzety')
      .select('*')
      .eq('household_id', householdId)
      .eq('rok', rok)
      .order('kategoria')
      .order('zakres')
      .order('miesiac');

    if (error) {
      handleAuthError(error);
    }

    return data.map(b => ({
      kategoria: b.kategoria,
      limit: b.limit_kwota,
      miesiac: b.miesiac,
      rok: b.rok,
      osoba: b.osoba || '',
      zakres: b.zakres,
      notatki: b.notatki || '',
    }));
  } catch (err) {
    handleAuthError(err);
  }
}

export async function setBudget(budget) {
  const householdId = await getHouseholdId();
  try {
    const record = {
      household_id: householdId,
      kategoria: budget.kategoria,
      limit_kwota: budget.limit,
      rok: Number(budget.rok),
      osoba: budget.osoba || null,
      zakres: budget.zakres,
      notatki: budget.notatki || null,
      miesiac: budget.zakres === 'monthly' ? Number(budget.miesiac) : null,
    };

    const { error } = await supabase
      .from('budzety')
      .upsert(record, {
        onConflict: 'household_id,kategoria,osoba,zakres,rok,miesiac',
      });

    if (error) {
      handleAuthError(error);
    }
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

export async function deleteBudget(budget) {
  const householdId = await getHouseholdId();
  try {
    let query = supabase
      .from('budzety')
      .delete()
      .eq('household_id', householdId)
      .eq('kategoria', budget.kategoria)
      .eq('zakres', budget.zakres)
      .eq('rok', budget.rok);

    if (budget.osoba) {
      query = query.eq('osoba', budget.osoba);
    } else {
      query = query.is('osoba', null);
    }

    if (budget.zakres === 'monthly' && budget.miesiac) {
      query = query.eq('miesiac', budget.miesiac);
    } else {
      query = query.is('miesiac', null);
    }

    const { error } = await query;
    if (error) {
      handleAuthError(error);
    }
    return { success: true };
  } catch (err) {
    handleAuthError(err);
  }
}

// ═══════════════════════════════════════════
// YEARLY SUMMARY FUNCTIONS
// ═══════════════════════════════════════════

export async function getTransakcjeForYear(rok) {
  // Check sessionStorage cache first
  const cacheKey = `yearly_transakcje_${rok}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const householdId = await getHouseholdId();
  const { data, error } = await supabase
    .from('transakcje')
    .select('id, data, typ, kwota, kategoria, podkategoria, osoba, komentarz')
    .eq('household_id', householdId)
    .gte('data', `${rok}-01-01`)
    .lt('data', `${rok + 1}-01-01`)
    .order('data', { ascending: false });

  if (error) handleAuthError(error);

  // Cache in sessionStorage
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // sessionStorage full — ignore
  }

  return data;
}

export async function getAvailableYears() {
  const householdId = await getHouseholdId();
  const { data, error } = await supabase
    .from('transakcje')
    .select('data')
    .eq('household_id', householdId)
    .order('data', { ascending: true })
    .limit(1);

  if (error) handleAuthError(error);
  if (!data || data.length === 0) return [new Date().getFullYear()];

  const firstYear = new Date(data[0].data).getFullYear();
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= firstYear; y--) {
    years.push(y);
  }
  return years;
}

// ═══════════════════════════════════════════
// COMBINED DATA FETCH
// ═══════════════════════════════════════════

export async function getAllData(miesiac, rok) {
  const [transakcje, kategorie, osoby] = await Promise.all([
    getTransakcje(miesiac, rok),
    getKategorie(),
    getOsoby(),
  ]);

  return { transakcje, kategorie, osoby };
}

// ═══════════════════════════════════════════
// OFFLINE QUEUE OPERATION PROCESSOR
// ═══════════════════════════════════════════

export async function processOfflineOperation(operation) {
  const { action, payload } = operation;

  switch (action) {
    case 'addTransakcja':
      return addTransakcja(payload.transakcja);
    case 'updateTransakcja':
      return updateTransakcja(payload.id, payload.transakcja);
    case 'deleteTransakcja':
      return deleteTransakcja(payload.id);
    default:
      throw new Error(`Nieznana operacja offline: ${action}`);
  }
}
