import { supabase } from '../lib/supabase';

const HOUSEHOLD_ID = import.meta.env.VITE_HOUSEHOLD_ID;

if (!HOUSEHOLD_ID) {
  throw new Error(
    'Brak VITE_HOUSEHOLD_ID!\n' +
    'Dodaj do .env.local:\n' +
    'VITE_HOUSEHOLD_ID=twoj-household-uuid'
  );
}

// ═══════════════════════════════════════════
// TRANSAKCJE
// ═══════════════════════════════════════════

export async function getTransakcje(miesiac, rok) {
  const startDate = `${rok}-${String(miesiac).padStart(2, '0')}-01`;
  const endDate = miesiac === 12
    ? `${rok + 1}-01-01`
    : `${rok}-${String(miesiac + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('transakcje')
    .select('id, data, typ, kwota, kategoria, podkategoria, osoba, komentarz')
    .eq('household_id', HOUSEHOLD_ID)
    .gte('data', startDate)
    .lt('data', endDate)
    .order('data', { ascending: false });

  if (error) throw error;
  return data;
}

export async function addTransakcja(transakcja) {
  const { data, error } = await supabase
    .from('transakcje')
    .insert({
      household_id: HOUSEHOLD_ID,
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

  if (error) throw error;
  return { success: true, id: data.id };
}

export async function updateTransakcja(id, transakcja) {
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
    .eq('household_id', HOUSEHOLD_ID);

  if (error) throw error;
  return { success: true };
}

export async function deleteTransakcja(id) {
  const { error } = await supabase
    .from('transakcje')
    .delete()
    .eq('id', id)
    .eq('household_id', HOUSEHOLD_ID);

  if (error) throw error;
  return { success: true };
}

export async function addTransakcjeBatch(transakcje) {
  const records = transakcje.map(t => {
    const kwota = typeof t.kwota === 'number' ? t.kwota : parseFloat(t.kwota);
    return {
      household_id: HOUSEHOLD_ID,
      data: t.data,
      typ: t.typ || (kwota < 0 ? 'Wydatek' : 'Przychód'),
      kwota: Math.abs(kwota),
      kategoria: t.kategoria,
      podkategoria: t.podkategoria || null,
      osoba: t.osoba || null,
      komentarz: t.komentarz || t.opis || null,
    };
  });

  const { data, error } = await supabase
    .from('transakcje')
    .insert(records)
    .select('id');

  if (error) throw error;
  return { success: true, count: data.length, ids: data.map(d => d.id) };
}

// ═══════════════════════════════════════════
// KATEGORIE
// ═══════════════════════════════════════════

export async function getKategorie() {
  const { data, error } = await supabase
    .from('kategorie')
    .select('typ, kategoria, podkategoria')
    .eq('household_id', HOUSEHOLD_ID)
    .order('typ')
    .order('kategoria')
    .order('podkategoria');

  if (error) throw error;

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
}

export async function addKategoria(typ, kategoria, podkategoria) {
  const { error } = await supabase
    .from('kategorie')
    .insert({
      household_id: HOUSEHOLD_ID,
      typ,
      kategoria,
      podkategoria: podkategoria || null,
    });

  if (error) throw error;
  return { success: true };
}

export async function deleteKategoria(typ, kategoria, podkategoria) {
  let query = supabase
    .from('kategorie')
    .delete()
    .eq('household_id', HOUSEHOLD_ID)
    .eq('typ', typ)
    .eq('kategoria', kategoria);

  if (podkategoria) {
    query = query.eq('podkategoria', podkategoria);
  }

  const { error } = await query;
  if (error) throw error;
  return { success: true };
}

// ═══════════════════════════════════════════
// OSOBY
// ═══════════════════════════════════════════

export async function getOsoby() {
  const { data, error } = await supabase
    .from('osoby')
    .select('nazwa')
    .eq('household_id', HOUSEHOLD_ID)
    .order('nazwa');

  if (error) throw error;
  return data.map(o => o.nazwa);
}

export async function addOsoba(osoba) {
  const { error } = await supabase
    .from('osoby')
    .insert({
      household_id: HOUSEHOLD_ID,
      nazwa: osoba,
    });

  if (error) throw error;
  return { success: true };
}

export async function deleteOsoba(osoba) {
  const { error } = await supabase
    .from('osoby')
    .delete()
    .eq('household_id', HOUSEHOLD_ID)
    .eq('nazwa', osoba);

  if (error) throw error;
  return { success: true };
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
  // Get monthly budgets for the specific month
  const { data: monthly, error: monthlyError } = await supabase
    .from('budzety')
    .select('*')
    .eq('household_id', HOUSEHOLD_ID)
    .eq('zakres', 'monthly')
    .eq('miesiac', miesiac)
    .eq('rok', rok);

  if (monthlyError) throw monthlyError;

  // Get yearly budgets
  const { data: yearly, error: yearlyError } = await supabase
    .from('budzety')
    .select('*')
    .eq('household_id', HOUSEHOLD_ID)
    .eq('zakres', 'yearly')
    .eq('rok', rok);

  if (yearlyError) throw yearlyError;

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
}

export async function getAllBudgetsForYear(rok) {
  const { data, error } = await supabase
    .from('budzety')
    .select('*')
    .eq('household_id', HOUSEHOLD_ID)
    .eq('rok', rok)
    .order('kategoria')
    .order('zakres')
    .order('miesiac');

  if (error) throw error;

  return data.map(b => ({
    kategoria: b.kategoria,
    limit: b.limit_kwota,
    miesiac: b.miesiac,
    rok: b.rok,
    osoba: b.osoba || '',
    zakres: b.zakres,
    notatki: b.notatki || '',
  }));
}

export async function setBudget(budget) {
  const record = {
    household_id: HOUSEHOLD_ID,
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

  if (error) throw error;
  return { success: true };
}

export async function deleteBudget(budget) {
  let query = supabase
    .from('budzety')
    .delete()
    .eq('household_id', HOUSEHOLD_ID)
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
  if (error) throw error;
  return { success: true };
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
