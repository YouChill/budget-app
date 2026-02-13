#!/usr/bin/env node

/**
 * Skrypt jednorazowej migracji: Google Sheets CSV → Supabase PostgreSQL
 *
 * Użycie:
 *   1. Wyeksportuj każdą zakładkę z Google Sheets jako CSV
 *      (File > Download > Comma Separated Values)
 *   2. Umieść pliki CSV w katalogu ./csv/
 *   3. Skopiuj .env.example → .env i uzupełnij dane
 *   4. npm install
 *   5. npm run migrate          (normalna migracja)
 *      npm run migrate:dry      (dry-run — bez zapisu do bazy)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

// ============================================
// KONFIGURACJA
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HOUSEHOLD_NAME = process.env.HOUSEHOLD_NAME || 'Moja Rodzina';

const CSV_PATHS = {
  transakcje: process.env.CSV_TRANSAKCJE || './csv/Transakcje.csv',
  kategorie: process.env.CSV_KATEGORIE || './csv/Kategorie.csv',
  osoby: process.env.CSV_OSOBY || './csv/Osoby.csv',
  budzety: process.env.CSV_BUDZETY || './csv/Budżety.csv',
};

// ============================================
// WALIDACJA KONFIGURACJI
// ============================================

function validateConfig() {
  const errors = [];

  if (!SUPABASE_URL) errors.push('Brak SUPABASE_URL w .env');
  if (!SUPABASE_SERVICE_KEY) errors.push('Brak SUPABASE_SERVICE_ROLE_KEY w .env');

  // Sprawdź czy pliki CSV istnieją (transakcje, kategorie, osoby — wymagane)
  for (const [name, csvPath] of Object.entries(CSV_PATHS)) {
    const resolved = path.resolve(__dirname, csvPath);
    if (name === 'budzety') {
      // Budżety opcjonalne
      if (!fs.existsSync(resolved)) {
        console.log(`⚠  Plik budżetów nie znaleziony (${resolved}) — pomijam budżety`);
        CSV_PATHS.budzety = null;
      }
    } else {
      if (!fs.existsSync(resolved)) {
        errors.push(`Plik CSV nie istnieje: ${resolved} (${name})`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n✗ Błędy konfiguracji:\n');
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error('\nSprawdź plik .env i ścieżki do CSV.\n');
    process.exit(1);
  }
}

// ============================================
// PARSOWANIE CSV
// ============================================

function parseCSV(filePath) {
  const resolved = path.resolve(__dirname, filePath);
  const content = fs.readFileSync(resolved, 'utf-8');

  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // zachowaj jako stringi, parsujemy ręcznie
  });

  if (result.errors.length > 0) {
    console.warn(`  Ostrzeżenia parsowania ${path.basename(filePath)}:`);
    result.errors.forEach((e) =>
      console.warn(`    Wiersz ${e.row}: ${e.message}`)
    );
  }

  return result.data;
}

// ============================================
// TRANSFORMACJA DANYCH
// ============================================

function transformOsoby(rows, householdId) {
  return rows
    .filter((row) => {
      const nazwa = (row['Osoba'] || '').trim();
      return nazwa.length > 0;
    })
    .map((row) => ({
      household_id: householdId,
      nazwa: row['Osoba'].trim(),
    }));
}

function transformKategorie(rows, householdId) {
  return rows
    .filter((row) => {
      const typ = (row['Typ'] || '').trim();
      const kategoria = (row['Kategoria'] || '').trim();
      return typ.length > 0 && kategoria.length > 0;
    })
    .map((row) => ({
      household_id: householdId,
      typ: row['Typ'].trim(),
      kategoria: row['Kategoria'].trim(),
      podkategoria: (row['Podkategoria'] || '').trim() || null,
    }));
}

function transformTransakcje(rows, householdId) {
  const errors = [];

  const transakcje = rows
    .map((row, index) => {
      const id = (row['ID'] || '').trim();
      const data = (row['Data'] || '').trim();
      const typ = (row['Typ'] || '').trim();
      const kwotaRaw = (row['Kwota'] || '').trim();
      const kategoria = (row['Kategoria'] || '').trim();

      // Walidacja pól wymaganych
      if (!data || !typ || !kwotaRaw || !kategoria) {
        errors.push(
          `Wiersz ${index + 2}: brakujące wymagane pole (data/typ/kwota/kategoria)`
        );
        return null;
      }

      // Walidacja typu
      if (!['Wydatek', 'Przychód'].includes(typ)) {
        errors.push(
          `Wiersz ${index + 2}: nieprawidłowy typ "${typ}"`
        );
        return null;
      }

      // Parsuj kwotę — obsługa polskiego formatu (przecinek jako separator dziesiętny)
      const kwotaStr = kwotaRaw.replace(/\s/g, '').replace(',', '.');
      const kwota = parseFloat(kwotaStr);
      if (isNaN(kwota) || kwota === 0) {
        errors.push(
          `Wiersz ${index + 2}: nieprawidłowa kwota "${kwotaRaw}"`
        );
        return null;
      }

      // Walidacja daty (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        errors.push(
          `Wiersz ${index + 2}: nieprawidłowy format daty "${data}" (oczekiwany YYYY-MM-DD)`
        );
        return null;
      }

      const record = {
        household_id: householdId,
        data,
        typ,
        kwota: Math.abs(kwota),
        kategoria,
        podkategoria: (row['Podkategoria'] || '').trim() || null,
        osoba: (row['Osoba'] || '').trim(),
        komentarz: (row['Komentarz'] || '').trim() || null,
      };

      // Zachowaj istniejące UUID jeśli jest
      if (id && isValidUUID(id)) {
        record.id = id;
      }

      return record;
    })
    .filter(Boolean);

  if (errors.length > 0) {
    console.warn(`\n  ⚠  Błędy walidacji transakcji (${errors.length}):`);
    errors.slice(0, 10).forEach((e) => console.warn(`    ${e}`));
    if (errors.length > 10) {
      console.warn(`    ... i ${errors.length - 10} więcej`);
    }
  }

  return { transakcje, errors };
}

function transformBudzety(rows, householdId) {
  return rows
    .filter((row) => {
      const kategoria = (row['Kategoria'] || '').trim();
      return kategoria.length > 0;
    })
    .map((row) => {
      const limitRaw = (row['Limit'] || '0').replace(/\s/g, '').replace(',', '.');
      const miesiacRaw = (row['Miesiąc'] || row['Miesiac'] || '').trim();
      const rokRaw = (row['Rok'] || '').trim();

      return {
        household_id: householdId,
        kategoria: row['Kategoria'].trim(),
        limit_kwota: parseFloat(limitRaw) || 0,
        miesiac: miesiacRaw ? parseInt(miesiacRaw, 10) || null : null,
        rok: parseInt(rokRaw, 10) || new Date().getFullYear(),
        osoba: (row['Osoba'] || '').trim() || null,
        zakres: (row['Zakres'] || 'monthly').trim().toLowerCase(),
        notatki: (row['Notatki'] || '').trim() || null,
      };
    });
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

// ============================================
// IMPORT DO SUPABASE
// ============================================

const BATCH_SIZE = 500;

async function insertBatch(supabase, table, records) {
  if (records.length === 0) return { inserted: 0, errors: [] };

  let totalInserted = 0;
  const allErrors = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase.from(table).insert(batch).select();

    if (error) {
      allErrors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      totalInserted += data.length;
    }
  }

  return { inserted: totalInserted, errors: allErrors };
}

// ============================================
// WERYFIKACJA SPÓJNOŚCI
// ============================================

async function verify(supabase, householdId, sourceData) {
  console.log('\n────────────────────────────────────────');
  console.log('WERYFIKACJA SPÓJNOŚCI DANYCH');
  console.log('────────────────────────────────────────\n');

  let allOk = true;

  // 1. Liczba osoby
  const { count: osobyCount } = await supabase
    .from('osoby')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);

  const osobyOk = osobyCount === sourceData.osoby.length;
  console.log(
    `  Osoby:       ${osobyOk ? '✓' : '✗'} Supabase: ${osobyCount}, CSV: ${sourceData.osoby.length}`
  );
  if (!osobyOk) allOk = false;

  // 2. Liczba kategorii
  const { count: kategorieCount } = await supabase
    .from('kategorie')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);

  const kategorieOk = kategorieCount === sourceData.kategorie.length;
  console.log(
    `  Kategorie:   ${kategorieOk ? '✓' : '✗'} Supabase: ${kategorieCount}, CSV: ${sourceData.kategorie.length}`
  );
  if (!kategorieOk) allOk = false;

  // 3. Liczba transakcji
  const { count: transakcjeCount } = await supabase
    .from('transakcje')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);

  const transakcjeOk = transakcjeCount === sourceData.transakcje.length;
  console.log(
    `  Transakcje:  ${transakcjeOk ? '✓' : '✗'} Supabase: ${transakcjeCount}, CSV: ${sourceData.transakcje.length}`
  );
  if (!transakcjeOk) allOk = false;

  // 4. Suma kwot wydatków
  const { data: wydatkiSum } = await supabase
    .from('transakcje')
    .select('kwota')
    .eq('household_id', householdId)
    .eq('typ', 'Wydatek');

  const dbWydatkiSum = (wydatkiSum || []).reduce(
    (sum, r) => sum + parseFloat(r.kwota),
    0
  );
  const csvWydatkiSum = sourceData.transakcje
    .filter((t) => t.typ === 'Wydatek')
    .reduce((sum, t) => sum + t.kwota, 0);

  const wydatkiOk = Math.abs(dbWydatkiSum - csvWydatkiSum) < 0.01;
  console.log(
    `  Suma wydatków:   ${wydatkiOk ? '✓' : '✗'} Supabase: ${dbWydatkiSum.toFixed(2)}, CSV: ${csvWydatkiSum.toFixed(2)}`
  );
  if (!wydatkiOk) allOk = false;

  // 5. Suma kwot przychodów
  const { data: przychodySum } = await supabase
    .from('transakcje')
    .select('kwota')
    .eq('household_id', householdId)
    .eq('typ', 'Przychód');

  const dbPrzychodySum = (przychodySum || []).reduce(
    (sum, r) => sum + parseFloat(r.kwota),
    0
  );
  const csvPrzychodySum = sourceData.transakcje
    .filter((t) => t.typ === 'Przychód')
    .reduce((sum, t) => sum + t.kwota, 0);

  const przychodyOk = Math.abs(dbPrzychodySum - csvPrzychodySum) < 0.01;
  console.log(
    `  Suma przychodów: ${przychodyOk ? '✓' : '✗'} Supabase: ${dbPrzychodySum.toFixed(2)}, CSV: ${csvPrzychodySum.toFixed(2)}`
  );
  if (!przychodyOk) allOk = false;

  // 6. Budżety (jeśli migrowane)
  if (sourceData.budzety !== null) {
    const { count: budzetyCount } = await supabase
      .from('budzety')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId);

    const budzetyOk = budzetyCount === sourceData.budzety.length;
    console.log(
      `  Budżety:     ${budzetyOk ? '✓' : '✗'} Supabase: ${budzetyCount}, CSV: ${sourceData.budzety.length}`
    );
    if (!budzetyOk) allOk = false;
  }

  // 7. Sprawdź unikalne osoby w transakcjach vs tabela osoby
  const { data: dbOsoby } = await supabase
    .from('osoby')
    .select('nazwa')
    .eq('household_id', householdId);

  const osobyNames = new Set((dbOsoby || []).map((o) => o.nazwa));
  const transOsoby = new Set(
    sourceData.transakcje.map((t) => t.osoba).filter((o) => o && o.length > 0)
  );

  const missingOsoby = [...transOsoby].filter((o) => !osobyNames.has(o));
  if (missingOsoby.length > 0) {
    console.log(
      `\n  ⚠  Osoby w transakcjach nieobecne w tabeli osoby: ${missingOsoby.join(', ')}`
    );
  }

  console.log(
    `\n  ${allOk ? '✓ WERYFIKACJA ZAKOŃCZONA POMYŚLNIE' : '✗ WYKRYTO ROZBIEŻNOŚCI — sprawdź powyżej'}\n`
  );

  return allOk;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n════════════════════════════════════════');
  console.log(' MIGRACJA: Google Sheets CSV → Supabase');
  console.log('════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('  TRYB DRY-RUN — dane NIE będą zapisane do bazy\n');
  }

  // 1. Walidacja konfiguracji
  validateConfig();

  // 2. Parsowanie CSV
  console.log('1. Parsowanie plików CSV...\n');

  const rawOsoby = parseCSV(CSV_PATHS.osoby);
  console.log(`   Osoby:       ${rawOsoby.length} wierszy`);

  const rawKategorie = parseCSV(CSV_PATHS.kategorie);
  console.log(`   Kategorie:   ${rawKategorie.length} wierszy`);

  const rawTransakcje = parseCSV(CSV_PATHS.transakcje);
  console.log(`   Transakcje:  ${rawTransakcje.length} wierszy`);

  let rawBudzety = null;
  if (CSV_PATHS.budzety) {
    rawBudzety = parseCSV(CSV_PATHS.budzety);
    console.log(`   Budżety:     ${rawBudzety.length} wierszy`);
  }

  if (DRY_RUN) {
    // W trybie dry-run pokaż transformacje bez zapisu
    const dummyId = '00000000-0000-0000-0000-000000000000';
    const osoby = transformOsoby(rawOsoby, dummyId);
    const kategorie = transformKategorie(rawKategorie, dummyId);
    const { transakcje, errors } = transformTransakcje(rawTransakcje, dummyId);
    const budzety = rawBudzety ? transformBudzety(rawBudzety, dummyId) : null;

    console.log('\n2. Transformacja (dry-run):\n');
    console.log(`   Osoby:       ${osoby.length} rekordów do importu`);
    console.log(`   Kategorie:   ${kategorie.length} rekordów do importu`);
    console.log(`   Transakcje:  ${transakcje.length} rekordów do importu (${errors.length} błędów walidacji)`);
    if (budzety) console.log(`   Budżety:     ${budzety.length} rekordów do importu`);

    // Pokaż przykładowe rekordy
    console.log('\n   Przykładowa transakcja:');
    if (transakcje[0]) console.log(`   ${JSON.stringify(transakcje[0], null, 2)}`);

    console.log('\n   Suma wydatków CSV:', transakcje
      .filter((t) => t.typ === 'Wydatek')
      .reduce((s, t) => s + t.kwota, 0)
      .toFixed(2));
    console.log('   Suma przychodów CSV:', transakcje
      .filter((t) => t.typ === 'Przychód')
      .reduce((s, t) => s + t.kwota, 0)
      .toFixed(2));

    console.log('\n✓ Dry-run zakończony. Uruchom bez --dry-run aby wykonać migrację.\n');
    return;
  }

  // 3. Połączenie z Supabase
  console.log('\n2. Łączenie z Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4. Tworzenie household
  console.log(`\n3. Tworzenie household "${HOUSEHOLD_NAME}"...`);

  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name: HOUSEHOLD_NAME })
    .select()
    .single();

  if (householdError) {
    console.error(`\n✗ Błąd tworzenia household: ${householdError.message}`);
    process.exit(1);
  }

  const householdId = household.id;
  console.log(`   ✓ Household ID: ${householdId}`);

  // 5. Transformacja danych
  console.log('\n4. Transformacja danych...');
  const osoby = transformOsoby(rawOsoby, householdId);
  const kategorie = transformKategorie(rawKategorie, householdId);
  const { transakcje, errors: transErrors } = transformTransakcje(rawTransakcje, householdId);
  const budzety = rawBudzety ? transformBudzety(rawBudzety, householdId) : null;

  console.log(`   Osoby:       ${osoby.length} rekordów`);
  console.log(`   Kategorie:   ${kategorie.length} rekordów`);
  console.log(`   Transakcje:  ${transakcje.length} rekordów (${transErrors.length} pominięto)`);
  if (budzety) console.log(`   Budżety:     ${budzety.length} rekordów`);

  // 6. Import do Supabase
  console.log('\n5. Import do Supabase...\n');

  // 6a. Osoby
  console.log('   [1/4] Osoby...');
  const osobyResult = await insertBatch(supabase, 'osoby', osoby);
  console.log(`         ✓ Wstawiono: ${osobyResult.inserted}`);
  if (osobyResult.errors.length > 0) {
    osobyResult.errors.forEach((e) => console.error(`         ✗ ${e}`));
  }

  // 6b. Kategorie
  console.log('   [2/4] Kategorie...');
  const kategorieResult = await insertBatch(supabase, 'kategorie', kategorie);
  console.log(`         ✓ Wstawiono: ${kategorieResult.inserted}`);
  if (kategorieResult.errors.length > 0) {
    kategorieResult.errors.forEach((e) => console.error(`         ✗ ${e}`));
  }

  // 6c. Transakcje
  console.log('   [3/4] Transakcje...');
  const transakcjeResult = await insertBatch(supabase, 'transakcje', transakcje);
  console.log(`         ✓ Wstawiono: ${transakcjeResult.inserted}`);
  if (transakcjeResult.errors.length > 0) {
    transakcjeResult.errors.forEach((e) => console.error(`         ✗ ${e}`));
  }

  // 6d. Budżety
  if (budzety && budzety.length > 0) {
    console.log('   [4/4] Budżety...');
    const budzetyResult = await insertBatch(supabase, 'budzety', budzety);
    console.log(`         ✓ Wstawiono: ${budzetyResult.inserted}`);
    if (budzetyResult.errors.length > 0) {
      budzetyResult.errors.forEach((e) => console.error(`         ✗ ${e}`));
    }
  } else {
    console.log('   [4/4] Budżety — pominięto');
  }

  // 7. Weryfikacja
  const sourceData = {
    osoby,
    kategorie,
    transakcje,
    budzety,
  };

  const ok = await verify(supabase, householdId, sourceData);

  // 8. Podsumowanie
  console.log('════════════════════════════════════════');
  console.log(` HOUSEHOLD ID: ${householdId}`);
  console.log(' Zachowaj ten ID — będzie potrzebny');
  console.log(' do konfiguracji aplikacji.');
  console.log('════════════════════════════════════════\n');

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('\n✗ Nieoczekiwany błąd:', err);
  process.exit(1);
});
