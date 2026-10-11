#!/usr/bin/env node
/**
 * Import zaległych transakcji 03–07.2026 do Budżetu Domowego.
 *
 * Wysyła payload IMPORT_pawel_2026-03_07.json przez RPC
 * importuj_transakcje (migracja 014) — tę samą ścieżkę co import CSV
 * w aplikacji i POST /api/v1/transakcje.
 *
 * Rekord: { data, typ, kwota, kategoria, podkategoria, osoba, komentarz,
 *           kwota_pelna?, udzial?, zrodlo?, zrodlo_id?, dokument? }.
 * Rekordy z zrodlo_id są idempotentne: ponowne uruchomienie pomija to,
 * co już weszło. Rekordy bez odcisku zachowują się jak wpis ręczny.
 *
 * Uruchomienie:
 *   node import_do_aplikacji.mjs --dry-run     # tylko walidacja, nic nie zapisuje
 *   node import_do_aplikacji.mjs               # właściwy import
 *
 * Wymaga w .env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *   IMPORT_EMAIL, IMPORT_PASSWORD   — konto, na które logujemy import
 *
 * Bezpieczniki:
 *   - --dry-run domyślnie sprawdza wszystko bez zapisu
 *   - rekordy z odciskiem: duplikaty pomija baza (raport „pominięte")
 *   - rekordy BEZ odcisku: jeśli w ich oknie dat są już transakcje, pyta,
 *     zanim cokolwiek doda — tych baza nie umie rozpoznać
 *   - każda partia to jedna transakcja bazy; przerywa przy pierwszym błędzie
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { pozycjaZRekordu, brakMigracji014 } from '../src/lib/importPozycje.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD = path.resolve(__dirname, 'IMPORT_pawel_2026-03_07.json');
const CHUNK = 100;
const DRY = process.argv.includes('--dry-run');

// ── konfiguracja ────────────────────────────────────────────────────────────
const {
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_ANON_KEY: KEY,
  IMPORT_EMAIL: EMAIL,
  IMPORT_PASSWORD: PASSWORD,
} = process.env;

if (!URL || !KEY || !EMAIL || !PASSWORD) {
  console.error('✗ Brak zmiennych środowiskowych. Wymagane: VITE_SUPABASE_URL, ' +
                'VITE_SUPABASE_ANON_KEY, IMPORT_EMAIL, IMPORT_PASSWORD');
  process.exit(1);
}

const ask = (q) => new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => { rl.close(); res(a.trim().toLowerCase()); });
});

// ── walidacja payloadu ──────────────────────────────────────────────────────
function waliduj(rekordy, kategorie, osoby) {
  const bledy = [];
  const dozwolone = new Set(
    kategorie.map((k) => `${k.typ}|${k.kategoria}|${k.podkategoria ?? ''}`)
  );
  const osobySet = new Set(osoby.map((o) => o.nazwa));

  rekordy.forEach((r, i) => {
    const w = `wiersz ${i + 1} (${r.data} ${r.kwota})`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data ?? '')) bledy.push(`${w}: zła data`);
    if (!['Wydatek', 'Przychód'].includes(r.typ)) bledy.push(`${w}: zły typ "${r.typ}"`);
    if (!(r.kwota > 0)) bledy.push(`${w}: kwota musi być dodatnia`);
    if (r.zrodlo_id && !r.zrodlo) bledy.push(`${w}: zrodlo_id bez zrodlo`);
    if (r.udzial && !/^[1-9]\d*\/[1-9]\d*$/.test(r.udzial)) bledy.push(`${w}: zły udział "${r.udzial}"`);
    if (!osobySet.has(r.osoba)) bledy.push(`${w}: nieznana osoba "${r.osoba}"`);
    const klucz = `${r.typ}|${r.kategoria}|${r.podkategoria ?? ''}`;
    if (!dozwolone.has(klucz)) bledy.push(`${w}: brak kategorii ${klucz}`);
  });
  return bledy;
}

// ── main ────────────────────────────────────────────────────────────────────
const rekordy = JSON.parse(fs.readFileSync(PAYLOAD, 'utf-8'));
console.log(`Payload: ${rekordy.length} transakcji z ${PAYLOAD}`);

const supabase = createClient(URL, KEY);
const { data: auth, error: authErr } =
  await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (authErr) { console.error('✗ Logowanie:', authErr.message); process.exit(1); }

const { data: profil, error: profErr } = await supabase
  .from('profiles').select('household_id').eq('id', auth.user.id).single();
if (profErr) { console.error('✗ Profil:', profErr.message); process.exit(1); }
const household_id = profil.household_id;
console.log(`Gospodarstwo: ${household_id}`);

// słowniki do walidacji
const [{ data: kategorie }, { data: osoby }] = await Promise.all([
  supabase.from('kategorie').select('typ, kategoria, podkategoria').eq('household_id', household_id),
  supabase.from('osoby').select('nazwa').eq('household_id', household_id),
]);
console.log(`Słownik: ${kategorie.length} kategorii, ${osoby.length} osób`);

const bledy = waliduj(rekordy, kategorie, osoby);
if (bledy.length) {
  console.error(`\n✗ Walidacja: ${bledy.length} błędów\n`);
  bledy.slice(0, 20).forEach((b) => console.error('  ' + b));
  if (bledy.length > 20) console.error(`  …i ${bledy.length - 20} więcej`);
  console.error('\nNic nie zostało zapisane. Uruchom migracje 009–011, jeśli brakuje kategorii.');
  process.exit(1);
}
console.log('✓ Walidacja przeszła');

// ochrona przed podwójnym importem — tylko dla rekordów bez odcisku;
// rekordy z zrodlo_id deduplikuje baza (ON CONFLICT w RPC)
const bezOdcisku = rekordy.filter((r) => !r.zrodlo_id);
console.log(`Odciski: ${rekordy.length - bezOdcisku.length} z odciskiem, ${bezOdcisku.length} bez`);
if (bezOdcisku.length > 0) {
  const daty = bezOdcisku.map((r) => r.data).sort();
  const { count } = await supabase
    .from('transakcje').select('id', { count: 'exact', head: true })
    .eq('household_id', household_id)
    .gte('data', daty[0]).lte('data', daty[daty.length - 1]);

  if (count > 0) {
    console.log(`\n⚠ ${bezOdcisku.length} rekordów bez odcisku, a w oknie ${daty[0]} – ${daty[daty.length - 1]} ` +
                `jest już ${count} transakcji. Tych rekordów baza nie rozpozna jako duplikatów.`);
    const odp = await ask('  Kontynuować mimo to? [tak/nie] ');
    if (odp !== 'tak') { console.log('Przerwano.'); process.exit(0); }
  }
}

if (DRY) {
  const wyd = rekordy.filter((r) => r.typ === 'Wydatek').reduce((s, r) => s + r.kwota, 0);
  const prz = rekordy.filter((r) => r.typ === 'Przychód').reduce((s, r) => s + r.kwota, 0);
  console.log(`\n── DRY RUN — nic nie zapisano ──`);
  console.log(`  wydatki   ${wyd.toFixed(2)}`);
  console.log(`  przychody ${prz.toFixed(2)}`);
  console.log(`  partie    ${Math.ceil(rekordy.length / CHUNK)} × do ${CHUNK}`);
  process.exit(0);
}

// właściwy import
const raport = { dodane: 0, pominiete: 0, polaczone: 0 };
for (let i = 0; i < rekordy.length; i += CHUNK) {
  const pozycje = rekordy.slice(i, i + CHUNK).map(pozycjaZRekordu);
  const { data, error } = await supabase.rpc('importuj_transakcje', { p: { pozycje } });
  if (error) {
    console.error(`\n✗ Partia ${i / CHUNK + 1}: ${error.message}`);
    if (brakMigracji014(error)) console.error('  Baza nie ma migracji 014_dowody_i_zobowiazania.sql — uruchom ją najpierw.');
    console.error(`  Przed błędem: dodano ${raport.dodane}, pominięto ${raport.pominiete}. ` +
                  'Partia z błędem wycofana w całości. Rekordy z odciskiem można bezpiecznie wysłać ponownie.');
    process.exit(1);
  }
  for (const k of Object.keys(raport)) raport[k] += data[k] || 0;
  process.stdout.write(`\r  przetworzono ${Math.min(i + CHUNK, rekordy.length)}/${rekordy.length}`);
}
console.log(`\n✓ Gotowe — dodano ${raport.dodane}, pominięto ${raport.pominiete} (już zaksięgowane), ` +
            `połączono z zobowiązaniami ${raport.polaczone}.`);
