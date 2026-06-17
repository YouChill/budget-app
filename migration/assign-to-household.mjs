#!/usr/bin/env node

/**
 * Skrypt: przypisanie użytkownika (np. żony) do istniejącego gospodarstwa (household).
 *
 * Kontekst:
 *   Każdy użytkownik należy do jednego gospodarstwa przez pole
 *   profiles.household_id. Po rejestracji trigger handle_new_user
 *   (migration/007) tworzy dla nowego użytkownika OSOBNE gospodarstwo.
 *   Aby dołączyć kogoś do istniejącej rodziny, trzeba zmienić jego
 *   household_id na ID gospodarstwa właściciela. Operacja wymaga
 *   uprawnień admina (service role key) — RLS blokuje to zwykłym userom.
 *
 * Co robi:
 *   1. Znajduje gospodarstwo właściciela po jego emailu (OWNER_EMAIL).
 *   2. Znajduje profil osoby do dołączenia po jej emailu (MEMBER_EMAIL).
 *   3. Pokazuje stan przed zmianą i — poza trybem --dry-run — ustawia
 *      jej household_id na gospodarstwo właściciela.
 *   4. Opcjonalnie (--cleanup) usuwa osierocone gospodarstwo, które
 *      osoba dostała przy rejestracji — TYLKO jeśli nie ma już w nim
 *      żadnych innych członków ani danych.
 *
 * Użycie:
 *   1. cd migration && npm install
 *   2. Uzupełnij .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      OWNER_EMAIL, MEMBER_EMAIL)
 *   3. node assign-to-household.mjs --dry-run     (podgląd, bez zapisu)
 *      node assign-to-household.mjs               (wykonanie)
 *      node assign-to-household.mjs --cleanup     (wykonanie + sprzątanie)
 *
 *   Można też nadpisać emaile argumentami:
 *      node assign-to-household.mjs --member=zona@example.com --owner=ja@example.com
 *   Albo wskazać gospodarstwo wprost (pomija szukanie po OWNER_EMAIL):
 *      node assign-to-household.mjs --household-id=<uuid>
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// ============================================
// KONFIGURACJA / ARGUMENTY
// ============================================

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CLEANUP = args.includes('--cleanup');

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MEMBER_EMAIL = (argValue('member') || process.env.MEMBER_EMAIL || '')
  .trim()
  .toLowerCase();
const OWNER_EMAIL = (argValue('owner') || process.env.OWNER_EMAIL || '')
  .trim()
  .toLowerCase();
const HOUSEHOLD_ID = argValue('household-id') || process.env.HOUSEHOLD_ID || null;

// ============================================
// WALIDACJA KONFIGURACJI
// ============================================

function validateConfig() {
  const errors = [];

  if (!SUPABASE_URL) errors.push('Brak SUPABASE_URL w .env');
  if (!SUPABASE_SERVICE_KEY) errors.push('Brak SUPABASE_SERVICE_ROLE_KEY w .env');
  if (!MEMBER_EMAIL) errors.push('Brak MEMBER_EMAIL (email osoby do dołączenia) w .env lub --member=');
  if (!HOUSEHOLD_ID && !OWNER_EMAIL) {
    errors.push('Podaj OWNER_EMAIL (właściciel rodziny) lub HOUSEHOLD_ID');
  }

  if (errors.length > 0) {
    console.error('\n✗ Błędy konfiguracji:\n');
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error('\nSprawdź plik .env / argumenty.\n');
    process.exit(1);
  }
}

// ============================================
// HELPERY
// ============================================

async function findProfileByEmail(supabase, email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, household_id')
    .ilike('email', email);

  if (error) throw new Error(`Błąd zapytania profiles (${email}): ${error.message}`);
  return data || [];
}

async function getHouseholdName(supabase, householdId) {
  if (!householdId) return null;
  const { data } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle();
  return data?.name ?? null;
}

// Tabele, które przechowują dane przypisane do household_id.
const HOUSEHOLD_DATA_TABLES = ['transakcje', 'kategorie', 'osoby', 'budzety'];

async function countHouseholdData(supabase, householdId) {
  const counts = {};
  for (const table of HOUSEHOLD_DATA_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId);
    // category_rules może nie istnieć w każdym wdrożeniu — ignorujemy błąd braku tabeli
    counts[table] = error ? 0 : count || 0;
  }
  return counts;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n════════════════════════════════════════');
  console.log(' PRZYPISANIE UŻYTKOWNIKA DO GOSPODARSTWA');
  console.log('════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('  TRYB DRY-RUN — żadne zmiany NIE zostaną zapisane\n');
  }

  validateConfig();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Ustal docelowe gospodarstwo
  let targetHouseholdId = HOUSEHOLD_ID;

  if (!targetHouseholdId) {
    console.log(`1. Szukam gospodarstwa właściciela (${OWNER_EMAIL})...`);
    const ownerProfiles = await findProfileByEmail(supabase, OWNER_EMAIL);

    if (ownerProfiles.length === 0) {
      console.error(`\n✗ Nie znaleziono profilu właściciela dla emaila: ${OWNER_EMAIL}`);
      console.error('  Upewnij się, że właściciel ma założone konto.\n');
      process.exit(1);
    }
    if (ownerProfiles.length > 1) {
      console.error(`\n✗ Znaleziono ${ownerProfiles.length} profili dla ${OWNER_EMAIL} — niejednoznaczne.`);
      ownerProfiles.forEach((p) => console.error(`    ${p.id} (household_id=${p.household_id})`));
      process.exit(1);
    }

    const owner = ownerProfiles[0];
    if (!owner.household_id) {
      console.error(`\n✗ Właściciel (${OWNER_EMAIL}) nie ma przypisanego household_id.`);
      console.error('  Zaloguj się raz na to konto w aplikacji, aby gospodarstwo zostało utworzone.\n');
      process.exit(1);
    }
    targetHouseholdId = owner.household_id;
    const name = await getHouseholdName(supabase, targetHouseholdId);
    console.log(`   ✓ Gospodarstwo docelowe: ${targetHouseholdId}${name ? ` ("${name}")` : ''}\n`);
  } else {
    const name = await getHouseholdName(supabase, targetHouseholdId);
    if (!name && name !== '') {
      console.error(`\n✗ Nie znaleziono gospodarstwa o ID: ${targetHouseholdId}\n`);
      process.exit(1);
    }
    console.log(`1. Gospodarstwo docelowe (z konfiguracji): ${targetHouseholdId}${name ? ` ("${name}")` : ''}\n`);
  }

  // 2. Znajdź profil osoby do dołączenia
  console.log(`2. Szukam profilu osoby do dołączenia (${MEMBER_EMAIL})...`);
  const memberProfiles = await findProfileByEmail(supabase, MEMBER_EMAIL);

  if (memberProfiles.length === 0) {
    console.error(`\n✗ Nie znaleziono profilu dla emaila: ${MEMBER_EMAIL}`);
    console.error('  Osoba musi mieć założone konto (zarejestrować/zalogować się raz).\n');
    process.exit(1);
  }
  if (memberProfiles.length > 1) {
    console.error(`\n✗ Znaleziono ${memberProfiles.length} profili dla ${MEMBER_EMAIL} — niejednoznaczne.`);
    memberProfiles.forEach((p) => console.error(`    ${p.id} (household_id=${p.household_id})`));
    process.exit(1);
  }

  const member = memberProfiles[0];
  const oldHouseholdId = member.household_id;
  console.log(`   ✓ Profil: ${member.id} (${member.display_name || 'brak nazwy'})`);
  console.log(`     Obecne household_id: ${oldHouseholdId || 'brak (NULL)'}\n`);

  // 3. Sprawdź czy nie jest już w docelowym gospodarstwie
  if (oldHouseholdId === targetHouseholdId) {
    console.log('✓ Osoba jest już przypisana do docelowego gospodarstwa — nic do zrobienia.\n');
    process.exit(0);
  }

  // 4. Przypisz
  console.log('3. Przypisanie do gospodarstwa...');
  console.log(`   ${MEMBER_EMAIL}: ${oldHouseholdId || 'NULL'}  →  ${targetHouseholdId}`);

  if (DRY_RUN) {
    console.log('   (dry-run — pominięto zapis)\n');
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .update({ household_id: targetHouseholdId })
      .eq('id', member.id)
      .select()
      .single();

    if (error) {
      console.error(`\n✗ Błąd aktualizacji profilu: ${error.message}\n`);
      process.exit(1);
    }
    console.log(`   ✓ Zaktualizowano. Nowe household_id: ${data.household_id}\n`);
  }

  // 5. Opcjonalne sprzątanie osieroconego gospodarstwa
  if (oldHouseholdId && oldHouseholdId !== targetHouseholdId) {
    console.log('4. Stare (poprzednie) gospodarstwo osoby...');

    const { count: remainingMembers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', oldHouseholdId);

    const data = await countHouseholdData(supabase, oldHouseholdId);
    const dataTotal = Object.values(data).reduce((s, n) => s + n, 0);
    const dataSummary = Object.entries(data)
      .map(([t, n]) => `${t}=${n}`)
      .join(', ');

    console.log(`   ID: ${oldHouseholdId}`);
    console.log(`   Pozostali członkowie: ${remainingMembers ?? '?'}`);
    console.log(`   Dane: ${dataSummary} (razem ${dataTotal})`);

    const safeToDelete = (remainingMembers ?? 0) === 0 && dataTotal === 0;

    if (!CLEANUP) {
      if (safeToDelete) {
        console.log('   ℹ Jest puste i osierocone. Uruchom z --cleanup, aby je usunąć.\n');
      } else {
        console.log('   ℹ Zachowane (ma członków lub dane).\n');
      }
    } else if (!safeToDelete) {
      console.log('   ⚠ Pominięto usuwanie — gospodarstwo NIE jest puste (ochrona danych).\n');
    } else if (DRY_RUN) {
      console.log('   (dry-run — pominięto usuwanie pustego gospodarstwa)\n');
    } else {
      const { error } = await supabase.from('households').delete().eq('id', oldHouseholdId);
      if (error) {
        console.log(`   ⚠ Nie udało się usunąć: ${error.message}\n`);
      } else {
        console.log('   ✓ Usunięto puste, osierocone gospodarstwo.\n');
      }
    }
  }

  console.log('════════════════════════════════════════');
  console.log(DRY_RUN ? ' DRY-RUN zakończony.' : ' GOTOWE.');
  console.log('════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n✗ Nieoczekiwany błąd:', err.message || err);
  process.exit(1);
});
