#!/usr/bin/env node
/**
 * Rozliczenie kolejki „Do rozliczenia” z pliku planu — zamiast klikania
 * setek wierszy w aplikacji.
 *
 * Plan (ROZLICZENIE_*.json) to lista pozycji:
 *   { dowod_id, osoba, data, kwota_pelna,          — kontrola: muszą się zgadzać z kolejką
 *     akcja: 'wyklucz' | 'zatwierdz',
 *     kategoria?, podkategoria?, udzial? }         — dla 'zatwierdz'
 *
 * Działa tą samą ścieżką co widok „Do rozliczenia”:
 *   - wyklucz   → UPDATE transakcje_dowody SET status = 'wykluczony' (RLS + strażnik)
 *   - zatwierdz → RPC kolejka_zatwierdz; transakcja jak w pozycjeZatwierdzenia():
 *                 komentarz = opis z kolejki, udział liczony udzialWGroszach()
 *                 i ślad „[udział 1/2 z … zł]” w komentarzu.
 * Loguje się jako zwykły użytkownik — RLS obowiązuje, nic nie omija bazy.
 *
 * Uruchomienie (z katalogu migration/):
 *   node --env-file=../.env rozlicz_kolejke.mjs ../ROZLICZENIE_x.json --dry-run
 *   node --env-file=../.env rozlicz_kolejke.mjs ../ROZLICZENIE_x.json
 *
 * Wymaga w .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, IMPORT_EMAIL, IMPORT_PASSWORD.
 *
 * Bezpieczniki:
 *   - --dry-run waliduje wszystko i nic nie zapisuje
 *   - pozycja planu, której wiersz w kolejce nie jest już „nowy” albo ma inną
 *     osobę/datę/kwotę, jest pomijana (raport) — nie zgadujemy
 *   - kategorie walidowane wobec słownika gospodarstwa przed pierwszym zapisem
 *   - ponowne uruchomienie jest bezpieczne: rozliczone wiersze nie są już „nowe”
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { naGrosze, udzialWGroszach, znacznikUdzialu, parsujUlamek } from '../src/lib/odciski.js';

const DRY = process.argv.includes('--dry-run');
const plikArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!plikArg) {
  console.error('✗ Podaj plik planu: node rozlicz_kolejke.mjs ../ROZLICZENIE_x.json [--dry-run]');
  process.exit(1);
}
const PLAN = path.resolve(process.cwd(), plikArg);
const CHUNK_RPC = 500;
const CHUNK_UPDATE = 200;

const {
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_ANON_KEY: KEY,
  IMPORT_EMAIL: EMAIL,
  IMPORT_PASSWORD: PASSWORD,
} = process.env;
if (!URL || !KEY || !EMAIL || !PASSWORD) {
  console.error('✗ Brak zmiennych: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, IMPORT_EMAIL, IMPORT_PASSWORD ' +
                '(uruchom z --env-file=../.env)');
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf-8'));
console.log(`Plan: ${plan.length} pozycji z ${PLAN}`);

const supabase = createClient(URL, KEY);
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (authErr) { console.error('✗ Logowanie:', authErr.message); process.exit(1); }
const { data: profil, error: profErr } = await supabase
  .from('profiles').select('household_id').eq('id', auth.user.id).single();
if (profErr) { console.error('✗ Profil:', profErr.message); process.exit(1); }
const household_id = profil.household_id;

// ── kolejka i słownik ───────────────────────────────────────────────────────
async function pobierzKolejke() {
  const wynik = [];
  for (let od = 0; ; od += 1000) {
    const { data, error } = await supabase.from('transakcje_dowody')
      .select('id, osoba, data, kwota_pelna, opis, status')
      .eq('household_id', household_id).eq('status', 'nowy')
      .order('id').range(od, od + 999);
    if (error) { console.error('✗ Kolejka:', error.message); process.exit(1); }
    wynik.push(...data);
    if (data.length < 1000) return wynik;
  }
}
const [kolejka, { data: kategorie, error: katErr }] = await Promise.all([
  pobierzKolejke(),
  supabase.from('kategorie').select('typ, kategoria, podkategoria').eq('household_id', household_id),
]);
if (katErr) { console.error('✗ Słownik:', katErr.message); process.exit(1); }
const slownik = new Set(kategorie.map((k) => `${k.typ}|${k.kategoria}|${k.podkategoria ?? ''}`));
const wKolejce = new Map(kolejka.map((d) => [d.id, d]));
console.log(`Gospodarstwo ${household_id}: w kolejce ${kolejka.length} nowych, słownik ${kategorie.length} pozycji`);

// ── walidacja i podział planu ───────────────────────────────────────────────
const bledy = [];
const pominiete = [];
const doWykluczenia = [];
const doZatwierdzenia = [];

for (const [i, p] of plan.entries()) {
  const w = `poz. ${i + 1} (${p.data} ${p.kwota_pelna})`;
  const d = wKolejce.get(p.dowod_id);
  if (!d) { pominiete.push(`${w}: nie ma jej w kolejce jako „nowa” (już rozliczona?)`); continue; }
  if (d.osoba !== p.osoba || d.data !== p.data || naGrosze(d.kwota_pelna) !== naGrosze(p.kwota_pelna)) {
    pominiete.push(`${w}: w kolejce jest ${d.osoba} ${d.data} ${d.kwota_pelna} — inna operacja niż w planie`);
    continue;
  }
  if (p.akcja === 'wyklucz') { doWykluczenia.push(d.id); continue; }
  if (p.akcja !== 'zatwierdz') { bledy.push(`${w}: nieznana akcja "${p.akcja}"`); continue; }

  const bruttoGr = naGrosze(d.kwota_pelna);
  const typ = bruttoGr < 0 ? 'Wydatek' : 'Przychód';
  const klucz = `${typ}|${p.kategoria}|${p.podkategoria ?? ''}`;
  if (!slownik.has(klucz)) { bledy.push(`${w}: brak w słowniku ${klucz}`); continue; }
  if (p.udzial && !parsujUlamek(p.udzial)) { bledy.push(`${w}: zły udział "${p.udzial}"`); continue; }

  const opis = String(d.opis ?? '').trim();
  const kwotaGr = Math.abs(p.udzial ? udzialWGroszach(bruttoGr, p.udzial) : bruttoGr);
  doZatwierdzenia.push({
    dowod_id: d.id,
    zobowiazanie_id: null,
    transakcja_id: null,
    transakcja: {
      data: d.data,
      typ,
      kwota: kwotaGr / 100,
      kategoria: p.kategoria,
      podkategoria: p.podkategoria || null,
      osoba: d.osoba,
      komentarz: (p.udzial ? `${opis} ${znacznikUdzialu(p.udzial, bruttoGr)}`.trim() : opis) || null,
      kwota_pelna: p.udzial ? Math.abs(bruttoGr) / 100 : null,
      udzial: p.udzial || null,
    },
  });
}

if (bledy.length) {
  console.error(`\n✗ Walidacja: ${bledy.length} błędów — nic nie zapisano`);
  bledy.slice(0, 30).forEach((b) => console.error('  ' + b));
  process.exit(1);
}

const suma = (typ) => doZatwierdzenia
  .filter((x) => x.transakcja.typ === typ)
  .reduce((s, x) => s + Math.round(x.transakcja.kwota * 100), 0) / 100;
console.log('✓ Walidacja przeszła');
console.log(`  do wykluczenia   ${doWykluczenia.length}`);
console.log(`  do zatwierdzenia ${doZatwierdzenia.length} ` +
            `(w tym z udziałem ${doZatwierdzenia.filter((x) => x.transakcja.udzial).length})`);
console.log(`    wydatki   ${suma('Wydatek').toFixed(2)} zł`);
console.log(`    przychody ${suma('Przychód').toFixed(2)} zł`);
if (pominiete.length) {
  console.log(`  pominięte        ${pominiete.length}`);
  pominiete.slice(0, 20).forEach((p) => console.log('    ' + p));
}
const poza = kolejka.length - doWykluczenia.length - doZatwierdzenia.length;
if (poza > 0) console.log(`  zostanie w kolejce (spoza planu) ${poza}`);

if (DRY) { console.log('\n── DRY RUN — nic nie zapisano ──'); process.exit(0); }

// ── zapis ───────────────────────────────────────────────────────────────────
let wykluczone = 0;
for (let i = 0; i < doWykluczenia.length; i += CHUNK_UPDATE) {
  const ids = doWykluczenia.slice(i, i + CHUNK_UPDATE);
  const { data, error } = await supabase.from('transakcje_dowody')
    .update({ status: 'wykluczony' })
    .eq('household_id', household_id).eq('status', 'nowy').in('id', ids)
    .select('id');
  if (error) { console.error(`\n✗ Wykluczanie: ${error.message} (wykluczono dotąd ${wykluczone})`); process.exit(1); }
  wykluczone += data.length;
}
console.log(`✓ Wykluczono ${wykluczone}`);

const raport = { zatwierdzone: 0, pominiete: 0 };
for (let i = 0; i < doZatwierdzenia.length; i += CHUNK_RPC) {
  const { data, error } = await supabase.rpc('kolejka_zatwierdz', { p: { pozycje: doZatwierdzenia.slice(i, i + CHUNK_RPC) } });
  if (error) {
    console.error(`\n✗ Zatwierdzanie, partia ${i / CHUNK_RPC + 1}: ${error.message} ` +
                  `(zatwierdzono dotąd ${raport.zatwierdzone}; ponowne uruchomienie dokończy resztę)`);
    process.exit(1);
  }
  raport.zatwierdzone += data.zatwierdzone || 0;
  raport.pominiete += data.pominiete || 0;
}
console.log(`✓ Zatwierdzono ${raport.zatwierdzone}` + (raport.pominiete ? `, pominięto ${raport.pominiete}` : ''));
