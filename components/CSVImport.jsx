import React, { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import * as api from '../src/services/api';
import * as categoryAI from '../src/services/categoryAI';
import ModalShell from '../src/components/ModalShell';
import ConfirmDialog from '../src/components/ConfirmDialog';
import Button from '../src/components/Button';
import { logger } from '../src/utils/logger';
import {
  tylkoCyfry,
  naGrosze,
  kluczMillennium,
  kluczPko,
  kluczRevolut,
  kluczCsv,
  rozroznijPowtorzenia,
  sha256Hex,
  udzialWGroszach,
  znacznikUdzialu,
} from '../src/lib/odciski';
import { parujPartie } from '../src/lib/parowanie';

// ─── Keyword → category mapping ──────────────────────────────────────────────
const categoryMapping = {
  // Jedzenie
  'biedronka': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'tesco': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'carrefour': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'makro': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'żabka': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'lidl': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'auchan': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'mc donald': { kategoria: 'Jedzenie', podkategoria: 'Restauracje/miasto' },
  'restauracja': { kategoria: 'Jedzenie', podkategoria: 'Restauracje/miasto' },
  'pizza': { kategoria: 'Jedzenie', podkategoria: 'Restauracje/miasto' },
  'kawa': { kategoria: 'Jedzenie', podkategoria: 'Kawa/przekąski' },
  'starbucks': { kategoria: 'Jedzenie', podkategoria: 'Kawa/przekąski' },
  // Transport
  'paliwo': { kategoria: 'Transport', podkategoria: 'Paliwo' },
  'bp': { kategoria: 'Transport', podkategoria: 'Paliwo' },
  'orlen': { kategoria: 'Transport', podkategoria: 'Paliwo' },
  'pkp': { kategoria: 'Transport', podkategoria: 'Komunikacja miejska' },
  'metro': { kategoria: 'Transport', podkategoria: 'Komunikacja miejska' },
  'uber': { kategoria: 'Transport', podkategoria: 'Komunikacja miejska' },
  // Mieszkanie
  'mieszkanie': { kategoria: 'Mieszkanie', podkategoria: 'Czynsz' },
  'czynsz': { kategoria: 'Mieszkanie', podkategoria: 'Czynsz' },
  'energa': { kategoria: 'Mieszkanie', podkategoria: 'Prąd' },
  'pge': { kategoria: 'Mieszkanie', podkategoria: 'Prąd' },
  'gaz': { kategoria: 'Mieszkanie', podkategoria: 'Gaz' },
  'woda': { kategoria: 'Mieszkanie', podkategoria: 'Woda' },
  'internet': { kategoria: 'Mieszkanie', podkategoria: 'Internet' },
  'telefon': { kategoria: 'Mieszkanie', podkategoria: 'Telefon' },
  // Zdrowie
  'apteka': { kategoria: 'Zdrowie', podkategoria: 'Leki' },
  'lekarz': { kategoria: 'Zdrowie', podkategoria: 'Lekarz' },
  'szpital': { kategoria: 'Zdrowie', podkategoria: 'Lekarz' },
  'dentyst': { kategoria: 'Zdrowie', podkategoria: 'Lekarz' },
  // Rozrywka
  'kino': { kategoria: 'Rozrywka', podkategoria: 'Kino/koncerty' },
  'spotify': { kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' },
  'netflix': { kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' },
  'hbo': { kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' },
  'amazon': { kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' },
  // Ubrania
  'h&m': { kategoria: 'Ubrania', podkategoria: 'Dorośli' },
  'zara': { kategoria: 'Ubrania', podkategoria: 'Dorośli' },
  'c&a': { kategoria: 'Ubrania', podkategoria: 'Dorośli' },
  'odzież': { kategoria: 'Ubrania', podkategoria: 'Dorośli' },
  // Dom
  'leroy merlin': { kategoria: 'Dom', podkategoria: 'Wyposażenie' },
  'jysk': { kategoria: 'Dom', podkategoria: 'Wyposażenie' },
  'ceneo': { kategoria: 'Dom', podkategoria: 'Wyposażenie' },
  // Inne
  'fryzjer': { kategoria: 'Inne', podkategoria: 'Fryzjer/kosmetyki' },
  'salon': { kategoria: 'Inne', podkategoria: 'Fryzjer/kosmetyki' },
  'kosmetyk': { kategoria: 'Inne', podkategoria: 'Fryzjer/kosmetyki' },
  'prezent': { kategoria: 'Inne', podkategoria: 'Prezenty' },
};

export const categorizeDescription = (description, userRules = [], typ = 'Wydatek') => {
  if (!description) return null;
  const lowerDesc = description.toLowerCase();
  for (const rule of userRules) {
    // Reguły sprzed wprowadzenia pola typ (bez rule.typ) stosujemy do obu typów.
    if (rule.typ && rule.typ !== typ) continue;
    if (lowerDesc.includes(rule.keyword.toLowerCase())) {
      return { kategoria: rule.kategoria, podkategoria: rule.podkategoria };
    }
  }
  // Wbudowany słownik zawiera wyłącznie kategorie wydatkowe — nie stosujemy go
  // do przychodów (np. zwrot „ZWROT ZAKUP BIEDRONKA" to nie wydatek Jedzenie).
  if (typ !== 'Wydatek') return null;
  for (const [keyword, category] of Object.entries(categoryMapping)) {
    if (lowerDesc.includes(keyword)) return category;
  }
  return null;
};

// Tytuł przelewu wskazujący rodzinę — zwrot od rodziców to rozliczenie, nie zwrot zakupu.
const RODZINA_RE = /\b(mama|mamy|mamo|tata|taty|tato|rodzice|rodzic[oó]w)\b/i;

/**
 * Strażnik znaku (skill rozliczenia-budzetu): reguły tekstowe nie patrzą na
 * znak kwoty, więc przychód potrafi dostać kategorię wydatkową („jajka" →
 * Jedzenie). Para spoza słownika TEGO typu jest przekierowywana — dla
 * przychodu do „Inne przychody", bo „Inne / Nieprzewidziane" istnieje tylko
 * po stronie wydatków.
 */
const fallbackKategorii = (kategorieProp, typ, opis) => {
  const inne = kategorieProp?.[typ]?.['Inne przychody'];
  if (typ === 'Przychód' && inne) {
    if (RODZINA_RE.test(opis || '') && inne.includes('Rozliczenia rodzinne')) {
      return { kategoria: 'Inne przychody', podkategoria: 'Rozliczenia rodzinne' };
    }
    return { kategoria: 'Inne przychody', podkategoria: inne.includes('Zwroty') ? 'Zwroty' : '' };
  }
  return { kategoria: 'Inne', podkategoria: 'Nieprzewidziane' };
};

export const validateCategoryExists = (kategoria, podkategoria, kategorieProp, typ, opis = '') => {
  const catExists = kategorieProp?.[typ]?.[kategoria];
  if (!catExists) return fallbackKategorii(kategorieProp, typ, opis);
  const subExists = catExists.includes(podkategoria);
  return { kategoria, podkategoria: subExists ? podkategoria : '' };
};

const STORAGE_KEY = 'csv_import_progress';
const RULES_STORAGE_KEY = 'csv_recognition_rules';

// ─── Date normalization ───────────────────────────────────────────────────────
// Accepts: "YYYY-MM-DD", "DD.MM.YYYY", "DD-MM-YYYY"
// Returns ISO string "YYYY-MM-DD" or null for invalid input.
//
// Walidujemy przez rekonstrukcję daty i porównanie składowych — dzięki temu
// nieistniejące daty (np. 30.02, 31.04) są odrzucane niezależnie od tego, czy
// silnik JS „przewija" je na kolejny miesiąc.
const isValidIsoDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
};

export const normalizeDateToISO = (dateStr) => {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return isValidIsoDate(str) ? str : null;
  }
  const match = str.match(/^(\d{2})[.\-](\d{2})[.\-](\d{4})$/);
  if (match) {
    const iso = `${match[3]}-${match[2]}-${match[1]}`;
    return isValidIsoDate(iso) ? iso : null;
  }
  return null;
};

// ─── Amount parsing ────────────────────────────────────────────────────────────
// Akceptuje formaty z separatorem tysięcy (kropka) i dziesiętnym (przecinek),
// np. "1.234,56" → 1234.56, a także zwykłe "-150,00" → -150. Liczby przekazane
// jako number są zwracane bez zmian (bez ryzyka ponownego przeparsowania).
export const parseKwota = (kwotaStr) => {
  if (kwotaStr == null || kwotaStr === '') return 0;
  if (typeof kwotaStr === 'number') return isNaN(kwotaStr) ? 0 : kwotaStr;
  let str = kwotaStr.toString().trim().replace(/[\s\u00A0]/g, '');
  if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// ─── PKO BP format detection & parsing ───────────────────────────────────────
const detectPkoBpFormat = (firstRow) => {
  if (!firstRow || !Array.isArray(firstRow) || firstRow.length < 7) return false;
  return (
    firstRow[0]?.trim() === 'Data operacji' &&
    firstRow[3]?.trim() === 'Kwota' &&
    firstRow[6]?.trim() === 'Opis transakcji'
  );
};

const extractPkoBpDescription = (row) => {
  const extraCols = row.slice(6).filter(v => v && v.trim());

  let locationName = null;
  let locationCity = null;
  for (const col of extraCols) {
    const m = col.match(/Lokalizacja:\s*Adres:\s*(.+?)(?:\s+Miasto:\s*(.+?))?(?:\s+Kraj:|$)/i);
    if (m) { locationName = m[1]?.trim(); locationCity = m[2]?.trim(); }
  }

  let tytul = null;
  for (const col of extraCols) {
    const m = col.match(/Tytuł:\s*(.+)/i);
    if (m) tytul = m[1].trim();
  }

  let nazwaOdbiorcy = null;
  for (const col of extraCols) {
    const m = col.match(/Nazwa (?:odbiorcy|nadawcy):\s*(.+)/i);
    if (m) nazwaOdbiorcy = m[1].trim();
  }

  const tytulIsNumeric = tytul && /^[\d\s/]+$/.test(tytul);
  const tytulUseful = tytul && !tytulIsNumeric;

  let cleanTytul = tytul;
  if (tytulUseful && cleanTytul) {
    cleanTytul = cleanTytul.replace(/\s*OD:\s*\d+\s*DO:\s*[\d*]+\s*$/, '').trim();
    cleanTytul = cleanTytul.replace(/^\d{6,}\s+\d{10,}\s*/, '').trim();
  }

  if (locationName) {
    return locationName + (locationCity ? `, ${locationCity}` : '');
  }
  if (tytulUseful && nazwaOdbiorcy) return `${cleanTytul} - ${nazwaOdbiorcy}`;
  if (tytulUseful) return cleanTytul;
  if (nazwaOdbiorcy) return nazwaOdbiorcy;
  return extraCols[0] || '';
};

// ─── Bank Millennium format detection & parsing ───────────────────────────────
// Headers: "Numer rachunku/karty","Data transakcji","Data rozliczenia",
//          "Rodzaj transakcji","Na konto/Z konta","Odbiorca/Zleceniodawca",
//          "Opis","Obciążenia","Uznania","Saldo","Waluta"
const detectMillenniumFormat = (firstRow) => {
  if (!firstRow || !Array.isArray(firstRow) || firstRow.length < 9) return false;
  return (
    firstRow[1]?.trim() === 'Data transakcji' &&
    firstRow[3]?.trim() === 'Rodzaj transakcji' &&
    firstRow[7]?.trim() === 'Obciążenia' &&
    firstRow[8]?.trim() === 'Uznania'
  );
};

const extractMillenniumDescription = (row) => {
  // row is a raw array: [nrRachunku, dataTx, dataRozl, rodzaj, naKonto, odbiorca, opis, obciaz, uznania, saldo, waluta]
  const rodzaj = (row[3] || '').toUpperCase();
  const odbiorca = (row[5] || '').trim();
  const opis = (row[6] || '').trim();

  const isCardOrTerminal =
    rodzaj.includes('ZAKUP') ||
    rodzaj.includes('PŁATNOŚĆ') ||
    rodzaj.includes('PLATNOSC') ||
    rodzaj.includes('WYPŁATA BLIK') ||
    rodzaj.includes('WYPLATA BLIK');

  if (isCardOrTerminal && opis) {
    // Opis format: "MERCHANT NAME  City CCC YYYY-MM-DD"
    // where CCC = 3-letter country code (POL, USA, NLD, IRL…)
    let cleaned = opis
      .replace(/\s+\d{4}-\d{2}-\d{2}$/, '')   // remove trailing date
      .replace(/\s+[A-Z]{2,3}$/, '')            // remove trailing country code
      .replace(/\s{2,}/g, ' ')                  // collapse multiple spaces
      .trim();
    return cleaned || opis;
  }

  // Transfers: recipient + opis (if opis is more than just a reference number)
  if (odbiorca) {
    const opisIsJustRef = !opis || /^[\d\s/\-]+$/.test(opis);
    return opisIsJustRef ? odbiorca : `${odbiorca} — ${opis}`;
  }

  return opis || rodzaj;
};

// ─── Revolut format detection ────────────────────────────────────────────────
// Headers: Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
const detectRevolutFormat = (firstRow) => {
  if (!firstRow || !Array.isArray(firstRow)) return false;
  const h = firstRow.map(c => c?.trim());
  return ['Started Date', 'Description', 'Amount', 'Balance'].every(n => h.includes(n));
};

// ─── Dane do odcisku (docs/DEDUP_TRANSAKCJI.md, sekcja 4) ────────────────────
// Liczone z SUROWEGO wiersza banku, zanim użytkownik cokolwiek edytuje —
// odcisk ma identyfikować operację w wyciągu, nie jej opis w aplikacji.
// Pełny numer konta nigdy nie trafia do `surowe` (tylko 4 ostatnie cyfry).
const ostatnie4 = (nr) => tylkoCyfry(nr).slice(-4) || null;

export const zrodloMillennium = (row) => ({
  zrodlo: 'millennium',
  klucz: kluczMillennium({
    nrRachunku: row[0],
    dataTransakcji: normalizeDateToISO(row[1]) || (row[1] || '').trim(),
    obciazenia: (row[7] || '').trim(),
    uznania: (row[8] || '').trim(),
    saldo: row[9],
    opis: row[6],
  }),
  rachunek: row[4] || '',
  tytul: row[6] || '',
  surowe: { konto: ostatnie4(row[0]), kontrahent_konto: ostatnie4(row[4]), rodzaj: (row[3] || '').trim() || null },
});

export const zrodloPko = (row) => {
  const extra = row.slice(6).filter(v => v && v.trim());
  const pole = (re) => extra.map(c => c.match(re)?.[1]?.trim()).find(Boolean) || '';
  const rachunek = pole(/Rachunek (?:odbiorcy|nadawcy):\s*([\d\s]+)/i);
  return {
    zrodlo: 'pko',
    klucz: kluczPko({
      dataOperacji: normalizeDateToISO(row[0]) || (row[0] || '').trim(),
      kwota: row[3],
      saldo: row[5],
      opis: extra.join(' | '),
    }),
    rachunek,
    tytul: pole(/Tytuł:\s*(.+)/i),
    surowe: { kontrahent_konto: ostatnie4(rachunek), rodzaj: (row[2] || '').trim() || null },
  };
};

export const zrodloRevolut = (obj) => ({
  zrodlo: 'revolut',
  klucz: kluczRevolut({
    startedDate: obj['Started Date'],
    amount: obj['Amount'],
    balance: obj['Balance'],
    description: obj['Description'],
  }),
  rachunek: '',
  tytul: obj['Description'] || '',
  surowe: { rodzaj: obj['Type'] || null, waluta: obj['Currency'] || null },
});

export const przesunDate = (iso, dni) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dni);
  return d.toISOString().slice(0, 10);
};

const wybierz = (obj, pola) => Object.fromEntries(pola.map(p => [p, obj[p] ?? null]));

/**
 * Nakłada wynik parowania (src/lib/parowanie.js) na transakcje podglądu.
 * Wiersz połączony z zobowiązaniem dostaje jego kategorię i udział — kwota
 * w podglądzie to już udział gospodarstwa, brutto zostaje w _dedup.kwotaPelna,
 * a w opisie ślad „[udział 1/2 z 265,47 zł]" (skill rozliczenia-budzetu).
 */
export const zastosujParowanie = (lista, wyniki, kategorie) =>
  lista.map((tx, i) => {
    const w = wyniki[i];
    const dedup = {
      ...tx._dedup,
      status: w.status,
      powod: w.powod ?? null,
      kontrahent: w.kontrahent ?? null,
      // Już zaksięgowane domyślnie odznaczone; pozostałe — do importu.
      wybrana: w.status !== 'zaksiegowana',
      akcja: 'nowa',
      reczne: (w.reczne || []).map(t => wybierz(t, ['id', 'data', 'kwota', 'kategoria', 'komentarz'])),
      kandydaci: (w.kandydaci || []).map(z => wybierz(z, ['id', 'kontrahent', 'dokument', 'kwota_pelna', 'termin'])),
    };
    if (w.status !== 'polaczona') return { ...tx, _dedup: dedup };

    const z = w.zobowiazanie;
    const next = { ...tx };
    dedup.zobowiazanie = wybierz(z, ['id', 'kontrahent', 'dokument', 'kwota_pelna', 'termin', 'udzial']);
    dedup.kontrahent = z.kontrahent;
    dedup.dokument = z.dokument;
    if (z.kategoria) {
      Object.assign(next, validateCategoryExists(z.kategoria, z.podkategoria || '', kategorie, tx.typ, tx.opis));
    }
    if (z.udzial) {
      const bruttoGr = Math.abs(naGrosze(tx.kwota));
      const udzialGr = udzialWGroszach(bruttoGr, z.udzial);
      next.kwota = (tx.typ === 'Wydatek' ? -udzialGr : udzialGr) / 100;
      next.opis = `${tx.opis || ''} ${znacznikUdzialu(z.udzial, bruttoGr)}`.trim();
      dedup.kwotaPelna = bruttoGr / 100;
      dedup.udzial = z.udzial;
    }
    return { ...next, _dedup: dedup };
  });

/**
 * Rekordy dla api.importujTransakcje() z transakcji podglądu. Pomija wiersze
 * odznaczone; zaznaczony „już zaksięgowany" wiersz idzie z `wymus` — RPC
 * utworzy go ponownie tylko wtedy, gdy poprzednią transakcję usunięto.
 */
export const rekordyImportu = (lista, osoba) =>
  lista
    .filter(tx => tx._dedup?.wybrana !== false)
    .map(tx => {
      const kwota = parseKwota(tx.kwota);
      const d = tx._dedup || {};
      return {
        data: tx.data,
        typ: tx.typ || (kwota < 0 ? 'Wydatek' : 'Przychód'),
        kwota,
        kategoria: tx.kategoria,
        podkategoria: tx.podkategoria,
        osoba,
        komentarz: tx.opis,
        zrodlo: d.zrodlo,
        zrodlo_id: d.zrodlo_id,
        surowe: d.surowe ?? null,
        kontrahent: d.kontrahent ?? null,
        dokument: d.dokument ?? null,
        kwota_pelna: d.kwotaPelna ?? null,
        udzial: d.udzial ?? null,
        zobowiazanie_id: d.zobowiazanie?.id ?? null,
        transakcja_id: d.akcja === 'dolacz' ? d.dolaczDo : null,
        do_weryfikacji: d.status === 'do_weryfikacji',
        wymus: d.status === 'zaksiegowana',
      };
    });

// ─── Ikony (SVG zamiast emoji — spójny rendering i czytniki ekranu) ──────────
const SparkleIcon = ({ size = 16 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
  </svg>
);

const BankIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 22h18" /><path d="M6 18v-7" /><path d="M10 18v-7" /><path d="M14 18v-7" /><path d="M18 18v-7" /><path d="m12 2 9 4H3z" />
  </svg>
);

const TableIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 9v12" />
  </svg>
);

const ListIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

// ─── Grupy w podglądzie importu ───────────────────────────────────────────────
const FILTRY_STATUSU = [
  { id: 'wszystkie', label: 'Wszystkie' },
  { id: 'nowa', label: 'Nowe' },
  { id: 'polaczona', label: 'Pasuje do faktury' },
  { id: 'do_weryfikacji', label: 'Do weryfikacji' },
  { id: 'zaksiegowana', label: 'Już zaksięgowane' },
];

const pasujeDoFiltra = (tx, filtr) =>
  filtr === 'wszystkie' || (tx._dedup?.status ?? 'nowa') === filtr;

const formatZl = (n) =>
  `${Math.abs(Number(n)).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

/** Odznaka statusu pod opisem wiersza + wybór dla możliwego duplikatu wpisu ręcznego. */
function DedupInfo({ dedup, onChange }) {
  const { status } = dedup;
  const badge = 'inline-block text-[11px] leading-tight px-2 py-0.5 rounded-full border mt-1 mr-1';

  if (status === 'zaksiegowana') {
    return (
      <div>
        <span className={`${badge} bg-gray-100 border-gray-200 text-gray-600`}>Już zaksięgowane</span>
        {dedup.istniejacaTransakcja === null && (
          <span className="text-[11px] text-gray-500">transakcję usunięto — zaznacz, aby dodać ponownie</span>
        )}
      </div>
    );
  }

  const reczny = dedup.reczne?.[0];
  return (
    <div>
      {status === 'polaczona' && dedup.zobowiazanie && (
        <span className={`${badge} bg-emerald-50 border-emerald-200 text-emerald-700`}>
          Faktura {dedup.zobowiazanie.kontrahent} {dedup.zobowiazanie.dokument}
          {dedup.udzial && ` · udział ${dedup.udzial}`}
        </span>
      )}
      {status === 'do_weryfikacji' && (
        <span
          className={`${badge} bg-amber-50 border-amber-200 text-amber-700`}
          title={dedup.kandydaci.map(z => `${z.kontrahent} ${z.dokument}`).join(', ')}
        >
          Do weryfikacji: {dedup.kandydaci.length === 1
            ? `może to ${dedup.kandydaci[0].kontrahent} ${dedup.kandydaci[0].dokument}`
            : `${dedup.kandydaci.length} faktury o tej kwocie`}
        </span>
      )}
      {reczny && (
        <div className="mt-1">
          <span className={`${badge} bg-orange-50 border-orange-200 text-orange-700`}>
            Możliwy duplikat wpisu z {reczny.data}: {reczny.komentarz || reczny.kategoria} {formatZl(reczny.kwota)}
          </span>
          <select
            aria-label="Co zrobić z możliwym duplikatem"
            value={dedup.wybrana === false ? 'pomin' : dedup.akcja}
            onChange={e => {
              const v = e.target.value;
              if (v === 'pomin') onChange({ wybrana: false });
              else if (v === 'dolacz') onChange({ wybrana: true, akcja: 'dolacz', dolaczDo: reczny.id });
              else onChange({ wybrana: true, akcja: 'nowa', dolaczDo: null });
            }}
            className="mt-1 border border-gray-200 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value="nowa">Dodaj jako nową</option>
            <option value="dolacz">To ten sam wpis — tylko zapisz dowód</option>
            <option value="pomin">Pomiń wiersz</option>
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Step indicator component ─────────────────────────────────────────────────
function StepIndicator({ current }) {
  const steps = [
    { n: 1, label: 'Plik' },
    { n: 2, label: 'Kolumny' },
    { n: 3, label: 'Podgląd' },
    { n: 4, label: 'Gotowe' },
  ];
  return (
    <div className="flex items-center justify-center gap-1 mb-6 select-none">
      {steps.map(({ n, label }, i) => (
        <React.Fragment key={n}>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                current > n
                  ? 'bg-emerald-500 text-white'
                  : current === n
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {current > n ? '✓' : n}
            </div>
            <span
              className={`text-sm hidden sm:block transition-colors ${
                current === n ? 'text-indigo-700 font-semibold' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-8 sm:w-12 rounded-full transition-all duration-300 ${
                current > n ? 'bg-emerald-400' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CSVImport({ onClose, kategorie = {}, osoby = [], onSaved }) {
  const [step, setStep] = useState(1);
  const [csvData, setCsvData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [columnMapping, setColumnMapping] = useState({
    data: null,
    kwota: null,
    uznania: null,
    opis: null,
  });
  const [transactions, setTransactions] = useState([]);
  const [txMeta, setTxMeta] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);
  // { dostepny: bool, powod?: 'migracja' | 'blad' } — czy rozpoznawanie
  // zaksięgowanych zadziałało; null przed krokiem 3.
  const [dedupInfo, setDedupInfo] = useState(null);
  const [importRaport, setImportRaport] = useState(null);

  // File drag state
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState(null);
  const fileInputRef = useRef(null);

  // AI state
  const aiEnabled = categoryAI.isAIEnabled();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMatchCount, setAiMatchCount] = useState(0);

  // Person selector
  const [selectedOsoba, setSelectedOsoba] = useState('');

  // Recognition rules
  const [recognitionRules, setRecognitionRules] = useState([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({ keyword: '', kategoria: '', podkategoria: '', typ: 'Wydatek' });
  const [ruleNotification, setRuleNotification] = useState(null);
  const [showRulesList, setShowRulesList] = useState(false);

  // Filtr grup w podglądzie: wszystkie / nowe / zaksięgowane / z faktury / do weryfikacji
  const [filtrStatusu, setFiltrStatusu] = useState('wszystkie');

  // Details column
  const [showDetailsColumn, setShowDetailsColumn] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RULES_STORAGE_KEY);
      if (saved) setRecognitionRules(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Zapisany postęp — zamiast window.confirm pokazujemy spójny dialog.
  const [restorePrompt, setRestorePrompt] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const { timestamp, transactions: savedTx, txMeta: savedMeta, step: savedStep, dedupInfo: savedDedup, osoba: savedOsoba } = parsed;
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && savedTx?.length > 0) {
        setRestorePrompt({ savedTx, savedMeta, savedStep, savedDedup, savedOsoba });
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleRestoreProgress = () => {
    const { savedTx, savedMeta, savedStep, savedDedup, savedOsoba } = restorePrompt;
    setTransactions(savedTx);
    if (savedMeta) setTxMeta(savedMeta);
    setDedupInfo(savedDedup ?? null);
    if (savedOsoba) setSelectedOsoba(savedOsoba);
    setStep(savedStep || 3);
    setRestorePrompt(null);
  };

  const handleDiscardProgress = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRestorePrompt(null);
  };

  useEffect(() => {
    if (step === 3 && transactions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), transactions, txMeta, step, dedupInfo, osoba: selectedOsoba }));
        setLastSaved(new Date());
      } catch { /* ignore */ }
    }
  }, [transactions, txMeta, step, dedupInfo, selectedOsoba]);

  useEffect(() => {
    if (!ruleNotification) return;
    const t = setTimeout(() => setRuleNotification(null), 4000);
    return () => clearTimeout(t);
  }, [ruleNotification]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // ── AI categorization pass after moving to step 3 ────────────────────────────
  useEffect(() => {
    if (step !== 3 || !aiEnabled) return;

    const uncategorizedIndices = transactions
      .map((tx, i) => ({ tx, i }))
      .filter(({ tx }) => tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane');

    if (uncategorizedIndices.length === 0) return;

    setAiLoading(true);
    setAiMatchCount(0);

    let cancelled = false;
    const run = async () => {
      try {
        const descriptions = transactions.map(tx => tx.opis || '');
        const aiResults = await categoryAI.categorizeWithAI(descriptions);
        if (cancelled) return;

        let matched = 0;
        setTransactions(prev =>
          prev.map((tx, i) => {
            if (tx.kategoria !== 'Inne' || tx.podkategoria !== 'Nieprzewidziane') return tx;
            if (!aiResults[i]) return tx;
            const validated = validateCategoryExists(
              aiResults[i].kategoria,
              aiResults[i].podkategoria,
              kategorie,
              tx.typ,
              tx.opis
            );
            if (validated.kategoria !== 'Inne') matched++;
            return { ...tx, ...validated };
          })
        );
        setAiMatchCount(matched);
      } catch (err) {
        if (!cancelled) logger.error('CSVImport', 'AI categorization pass failed:', err);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── File handling ─────────────────────────────────────────────────────────────

  const processFile = (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      setError('Proszę wybrać plik CSV');
      return;
    }
    setSelectedFileName(file.name);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length < 2) {
          setError('Plik CSV jest pusty lub zawiera za mało danych');
          return;
        }

        const firstRow = results.data[0];

        if (detectPkoBpFormat(firstRow)) {
          const dataRows = results.data.slice(1);
          const processed = dataRows.map(row => ({
            'Data operacji': row[0] || '',
            'Data waluty': row[1] || '',
            'Typ transakcji': row[2] || '',
            'Kwota': row[3] || '',
            'Waluta': row[4] || '',
            'Saldo po transakcji': row[5] || '',
            'Opis (wyodrębniony)': extractPkoBpDescription(row),
            'Opis oryginalny': row.slice(6).filter(v => v && v.trim()).join(' | '),
            __zrodlo: zrodloPko(row),
          }));
          setCsvData(processed);
          setHeaders(['Data operacji', 'Data waluty', 'Typ transakcji', 'Kwota', 'Waluta', 'Saldo po transakcji', 'Opis (wyodrębniony)', 'Opis oryginalny']);
          setDetectedFormat('pko_bp');
          setColumnMapping({ data: 'Data operacji', kwota: 'Kwota', uznania: null, opis: 'Opis (wyodrębniony)' });
          setStep(2);
        } else if (detectMillenniumFormat(firstRow)) {
          const dataRows = results.data.slice(1);
          const processed = dataRows.map(row => ({
            'Data transakcji': row[1] || '',
            'Rodzaj transakcji': row[3] || '',
            'Na konto/Z konta': row[4] || '',
            'Odbiorca/Zleceniodawca': row[5] || '',
            'Opis': row[6] || '',
            'Obciążenia': row[7] || '',
            'Uznania': row[8] || '',
            'Saldo': row[9] || '',
            'Waluta': row[10] || '',
            'Opis (wyodrębniony)': extractMillenniumDescription(row),
            __zrodlo: zrodloMillennium(row),
          }));
          setCsvData(processed);
          setHeaders(['Data transakcji', 'Rodzaj transakcji', 'Na konto/Z konta', 'Odbiorca/Zleceniodawca', 'Opis', 'Obciążenia', 'Uznania', 'Saldo', 'Waluta', 'Opis (wyodrębniony)']);
          setDetectedFormat('millennium');
          setColumnMapping({ data: 'Data transakcji', kwota: 'Obciążenia', uznania: 'Uznania', opis: 'Opis (wyodrębniony)' });
          setStep(2);
        } else if (detectRevolutFormat(firstRow)) {
          const h = firstRow.map(c => c?.trim());
          const processed = results.data.slice(1)
            .map(row => Object.fromEntries(h.map((name, i) => [name, row[i] || ''])))
            // PENDING nie ma jeszcze salda — po zaksięgowaniu dostałby inny
            // odcisk i wszedłby drugi raz. REVERTED/DECLINED to nie przepływ.
            .filter(obj => !obj['State'] || obj['State'].trim().toUpperCase() === 'COMPLETED')
            .map(obj => ({
              'Data': (obj['Started Date'] || '').slice(0, 10),
              'Kwota': obj['Amount'],
              'Opis': obj['Description'],
              'Typ': obj['Type'] || '',
              'Waluta': obj['Currency'] || '',
              'Saldo': obj['Balance'] || '',
              __zrodlo: zrodloRevolut(obj),
            }));
          setCsvData(processed);
          setHeaders(['Data', 'Kwota', 'Opis', 'Typ', 'Waluta', 'Saldo']);
          setDetectedFormat('revolut');
          setColumnMapping({ data: 'Data', kwota: 'Kwota', uznania: null, opis: 'Opis' });
          setStep(2);
        } else {
          const looksLikeHeaders = firstRow.some(cell =>
            typeof cell === 'string' &&
            cell.trim() &&
            !/^\d{4}-\d{2}-\d{2}$/.test(cell.trim()) &&
            !/^[+-]?\d+([.,]\d+)?$/.test(cell.trim())
          );

          if (looksLikeHeaders) {
            const headerRow = firstRow;
            const dataRows = results.data.slice(1);
            const processed = dataRows.map(row => {
              const obj = {};
              headerRow.forEach((h, i) => { obj[h?.trim() || `Kolumna ${i + 1}`] = row[i] || ''; });
              return obj;
            });
            setCsvData(processed);
            setHeaders(headerRow.map((h, i) => h?.trim() || `Kolumna ${i + 1}`));
            setDetectedFormat(null);
            setStep(2);
          } else {
            const generatedHeaders = firstRow.map((_, i) => `Kolumna ${i + 1}`);
            const processed = results.data.map(row => {
              const obj = {};
              generatedHeaders.forEach((h, i) => { obj[h] = row[i] || ''; });
              return obj;
            });
            setCsvData(processed);
            setHeaders(generatedHeaders);
            setDetectedFormat(null);
            setStep(2);
          }
        }
      },
      error: (err) => setError(`Błąd parsowania CSV: ${err.message}`),
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the drop zone itself (not a child)
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // ── Column mapping ────────────────────────────────────────────────────────────

  const handleMappingChange = (field, value) => {
    setColumnMapping(prev => ({ ...prev, [field]: value }));
  };


  // ── Prepare transactions (step 2 → 3) ────────────────────────────────────────

  const prepareTransactions = async () => {
    if (!columnMapping.data || (!columnMapping.kwota && !columnMapping.uznania)) {
      setError('Musisz zmapować co najmniej kolumnę daty i kwoty');
      return false;
    }
    if (!selectedOsoba) {
      setError('Musisz wybrać osobę przed przejściem dalej');
      return false;
    }

    const hasSplitColumns = columnMapping.uznania;
    const saldoHeader = headers.find(h => /^(saldo|balance)/i.test(h || ''));
    let skipped = 0;

    // Buduj transakcję wraz z jej metadanymi w jednym obiekcie, a meta zindeksuj
    // dopiero po odfiltrowaniu wierszy z błędną datą — dzięki temu klucze meta
    // pozostają wyrównane do finalnej tablicy transakcji (brak rozjazdu).
    const processedWithMeta = csvData
      .filter(row => {
        if (!row[columnMapping.data]) return false;
        if (hasSplitColumns) {
          const hasDebit = columnMapping.kwota && row[columnMapping.kwota]?.toString().trim();
          const hasCredit = row[columnMapping.uznania]?.toString().trim();
          return hasDebit || hasCredit;
        }
        return row[columnMapping.kwota];
      })
      .map((row) => {
        const opis = columnMapping.opis ? row[columnMapping.opis] : '';
        let kwotaNum;
        let typ;

        if (hasSplitColumns) {
          // Kolumna obciążeń = wydatek (zawsze ujemny), kolumna uznań = przychód
          // (zawsze dodatni) — niezależnie od znaku w pliku banku.
          const debitStr = columnMapping.kwota ? row[columnMapping.kwota]?.toString().trim() : '';
          const creditStr = row[columnMapping.uznania]?.toString().trim() || '';
          if (creditStr) {
            kwotaNum = Math.abs(parseKwota(creditStr));
            typ = 'Przychód';
          } else {
            kwotaNum = -Math.abs(parseKwota(debitStr));
            typ = 'Wydatek';
          }
        } else {
          kwotaNum = parseKwota(row[columnMapping.kwota]);
          typ = kwotaNum < 0 ? 'Wydatek' : 'Przychód';
        }

        const categoryData = categorizeDescription(opis, recognitionRules, typ);
        const rawKategoria = categoryData?.kategoria || 'Inne';
        const rawPodkategoria = categoryData?.podkategoria || 'Nieprzewidziane';
        const validated = validateCategoryExists(rawKategoria, rawPodkategoria, kategorie, typ, opis);

        const csvRawFields = {};
        for (const [key, value] of Object.entries(row)) {
          if (key.startsWith('__')) continue; // pola techniczne odcisku
          if (key !== columnMapping.data && key !== columnMapping.kwota && key !== columnMapping.opis) {
            csvRawFields[key] = value;
          }
        }

        const isoDate = normalizeDateToISO(row[columnMapping.data]);
        if (!isoDate) {
          skipped++;
          return null;
        }

        // Formaty rozpoznane (Millennium/PKO/Revolut) mają odcisk z parsowania;
        // dowolny CSV dostaje odcisk z zmapowanych kolumn (+ saldo, jeśli jest).
        const zrodlo = row.__zrodlo || {
          zrodlo: 'csv',
          klucz: kluczCsv({
            data: isoDate,
            kwota: kwotaNum,
            saldo: saldoHeader ? row[saldoHeader] : '',
            opis,
          }),
          rachunek: '',
          tytul: opis,
          surowe: null,
        };

        return {
          tx: { data: isoDate, kwota: kwotaNum, opis, kategoria: validated.kategoria, podkategoria: validated.podkategoria, typ, _zrodlo: zrodlo },
          meta: { _originalOpis: opis, _csvRaw: csvRawFields },
        };
      })
      .filter(Boolean);

    const processed = processedWithMeta.map(x => x.tx);
    const meta = {};
    processedWithMeta.forEach((x, i) => { meta[i] = x.meta; });

    if (processed.length === 0) {
      setError('Brak poprawnych wierszy do importu (sprawdź format daty: YYYY-MM-DD lub DD.MM.YYYY)');
      return false;
    }
    if (skipped > 0) {
      setError(`Pominięto ${skipped} ${skipped === 1 ? 'wiersz' : 'wierszy'} z nieprawidłową datą.`);
    }

    setIsLoading(true);
    let oznaczone = processed;
    try {
      oznaczone = await oznaczZaksiegowane(processed);
    } finally {
      setIsLoading(false);
    }

    setTransactions(oznaczone);
    setTxMeta(meta);
    setCsvData(null);
    setStep(3);
    return true;
  };

  // ── Rozpoznawanie już zaksięgowanych (step 2 → 3) ─────────────────────────────
  // Odciski → zapytanie o istniejące → parowanie z zobowiązaniami i wpisami
  // bez dowodu. Błąd sieci lub brak migracji 014 nie blokuje importu —
  // podgląd pokazuje wtedy ostrzeżenie, a zapis idzie starą ścieżką.
  const oznaczZaksiegowane = async (lista) => {
    const bezKlucza = (tx) => {
      const { _zrodlo, ...reszta } = tx;
      return reszta;
    };
    try {
      const klucze = rozroznijPowtorzenia(lista.map(tx => tx._zrodlo.klucz));
      const odciski = await Promise.all(klucze.map(k => sha256Hex(k)));
      const zrodlo = lista[0]._zrodlo.zrodlo;

      const istniejace = await api.sprawdzOdciski(zrodlo, odciski);
      if (istniejace === null) {
        setDedupInfo({ dostepny: false, powod: 'migracja' });
        return lista.map(bezKlucza);
      }

      const daty = lista.map(tx => tx.data).sort();
      const kontekst = await api.getKontekstParowania(przesunDate(daty[0], -2), przesunDate(daty[daty.length - 1], 2));
      if (kontekst === null) {
        setDedupInfo({ dostepny: false, powod: 'migracja' });
        return lista.map(bezKlucza);
      }

      const wiersze = lista.map((tx, i) => ({
        zrodloId: odciski[i],
        data: tx.data,
        typ: tx.typ,
        kwotaGr: Math.abs(naGrosze(tx.kwota)),
        opis: tx.opis,
        tytul: tx._zrodlo.tytul,
        rachunek: tx._zrodlo.rachunek,
      }));
      const wyniki = parujPartie(wiersze, {
        istniejace: new Set(istniejace.keys()),
        zobowiazania: kontekst.zobowiazania,
        aliasy: kontekst.aliasy,
        bezDowodu: kontekst.bezDowodu,
      });

      setDedupInfo({ dostepny: true });
      return zastosujParowanie(
        lista.map((tx, i) => ({
          ...bezKlucza(tx),
          _dedup: {
            zrodlo,
            zrodlo_id: odciski[i],
            surowe: tx._zrodlo.surowe,
            // null = dowód jest, ale jego transakcję usunięto
            istniejacaTransakcja: istniejace.get(odciski[i]) ?? null,
          },
        })),
        wyniki,
        kategorie
      );
    } catch (err) {
      logger.error('CSVImport', 'rozpoznawanie zaksięgowanych nie powiodło się:', err);
      setDedupInfo({ dostepny: false, powod: 'blad' });
      return lista.map(bezKlucza);
    }
  };

  // ── Recognition rules ─────────────────────────────────────────────────────────

  const applyRuleToTransactions = useCallback((rule, currentTransactions) => {
    const keyword = rule.keyword.toLowerCase();
    let matchCount = 0;
    const updated = currentTransactions.map(tx => {
      if (tx.kategoria !== 'Inne' || tx.podkategoria !== 'Nieprzewidziane') return tx;
      if (rule.typ && tx.typ !== rule.typ) return tx;
      if ((tx.opis || '').toLowerCase().includes(keyword)) {
        matchCount++;
        return { ...tx, kategoria: rule.kategoria, podkategoria: rule.podkategoria || '' };
      }
      return tx;
    });
    return { updated, matchCount };
  }, []);

  const handleAddRule = async () => {
    const { keyword, kategoria, podkategoria, typ } = ruleForm;
    if (!keyword.trim()) { setError('Podaj warunek (tekst do wyszukania)'); return; }
    if (!kategoria) { setError('Wybierz kategorię'); return; }

    const newRule = { keyword: keyword.trim(), kategoria, podkategoria: podkategoria || '', typ, createdAt: Date.now() };

    const updatedRules = [...recognitionRules, newRule];
    setRecognitionRules(updatedRules);
    try { localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(updatedRules)); } catch { /* ignore */ }

    // Save to Supabase vector store (non-blocking)
    if (aiEnabled) {
      categoryAI.saveCategoryRule(keyword.trim(), kategoria, podkategoria, 'manual')
        .catch(err => logger.error('CSVImport', 'saveCategoryRule failed:', err));
    }

    const { updated, matchCount } = applyRuleToTransactions(newRule, transactions);
    setTransactions(updated);
    setRuleNotification({ keyword: newRule.keyword, kategoria, podkategoria, matchCount });
    setRuleForm({ keyword: '', kategoria: '', podkategoria: '', typ: 'Wydatek' });
    setShowRuleForm(false);
  };

  const handleDeleteRule = (index) => {
    const updatedRules = recognitionRules.filter((_, i) => i !== index);
    setRecognitionRules(updatedRules);
    try { localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(updatedRules)); } catch { /* ignore */ }
  };

  // ── Import ────────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const doImportu = transactions.filter(tx => tx._dedup?.wybrana !== false);
    if (doImportu.length === 0) { setError('Brak zaznaczonych transakcji do importu'); return; }

    setIsLoading(true);
    try {
      // tx.kwota jest już liczbą (z przygotowania lub onBlur); parseKwota
      // przepuszcza liczby bez zmian, więc nie psuje wartości typu 1.234.
      const rekordy = rekordyImportu(transactions, selectedOsoba);
      let raport;
      if (dedupInfo?.dostepny) {
        raport = await api.importujTransakcje(rekordy);
      } else {
        // Baza bez migracji 014 albo nieudane sprawdzenie — stara ścieżka,
        // bez ochrony przed podwójnym importem (podgląd o tym ostrzegał).
        const data = await api.addTransakcjeBatch(rekordy.map(r => ({ ...r, opis: r.komentarz })));
        raport = { success: data.success, dodane: data.count, pominiete: 0, polaczone: 0, dolaczone: 0 };
      }

      if (raport.success) {
        localStorage.removeItem(STORAGE_KEY);
        setImportRaport(raport);
        setStep(4);
        if (onSaved) onSaved();

        // Save AI category rules in background (non-blocking)
        if (aiEnabled) {
          categoryAI.saveCategoryRulesBatch(rekordy.map(r => ({ ...r, opis: r.komentarz })))
            .catch(err => logger.error('CSVImport', 'saveCategoryRulesBatch failed:', err));
        }
      }
    } catch (err) {
      logger.error('CSVImport', 'handleImport failed:', err);
      setError(err.message || 'Błąd importu. Twój postęp został zapisany lokalnie.');
      setIsLoading(false);
    }
  };

  // Wybór wiersza i akcja dla możliwego duplikatu wpisu ręcznego.
  const handleDedupChange = useCallback((index, zmiany) => {
    setTransactions(prev => prev.map((tx, i) =>
      i === index && tx._dedup ? { ...tx, _dedup: { ...tx._dedup, ...zmiany } } : tx
    ));
  }, []);

  // ── Edit / delete transactions ────────────────────────────────────────────────

  const handleEditTransaction = useCallback((index, field, value) => {
    setTransactions(prev => prev.map((tx, i) => {
      if (i !== index) return tx;
      const updated = { ...tx, [field]: value };
      // Gdy zmienia się kwota, utrzymuj typ zgodny ze znakiem, aby listy
      // kategorii/podkategorii (filtrowane po typ) pozostały spójne.
      if (field === 'kwota') {
        const num = typeof value === 'number' ? value : parseKwota(value);
        if (!isNaN(num) && num !== 0) updated.typ = num < 0 ? 'Wydatek' : 'Przychód';
      }
      return updated;
    }));
  }, []);

  const handleDeleteTransaction = (index) => {
    setTransactions(prev => prev.filter((_, i) => i !== index));
    // Przebuduj meta zachowując wyrównanie do nowych, zwartych indeksów tablicy
    // transakcji — iterujemy po wszystkich istniejących kluczach meta, pomijamy
    // usuwany indeks i przesuwamy kolejne w dół.
    setTxMeta(prev => {
      const keys = Object.keys(prev).map(Number).sort((a, b) => a - b);
      const next = {};
      let newIdx = 0;
      for (const k of keys) {
        if (k === index) continue;
        next[newIdx] = prev[k];
        newIdx++;
      }
      return next;
    });
  };

  const handleClose = () => {
    if (step === 4) localStorage.removeItem(STORAGE_KEY);
    onClose();
  };

  const toggleRowExpand = (idx) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  // ── Derived values ────────────────────────────────────────────────────────────

  const ruleCategories = Object.keys(kategorie?.[ruleForm.typ] || {});
  const ruleSubcategories = kategorie?.[ruleForm.typ]?.[ruleForm.kategoria] || [];
  const liczbaDoImportu = transactions.filter(tx => tx._dedup?.wybrana !== false).length;
  const liczbyStatusow = transactions.reduce((acc, tx) => {
    const st = tx._dedup?.status ?? 'nowa';
    acc[st] = (acc[st] || 0) + 1;
    acc.wszystkie = (acc.wszystkie || 0) + 1;
    return acc;
  }, {});
  const unmappedCount = transactions.filter(
    tx => tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane'
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <ModalShell onClose={handleClose} labelId="csv-import-title" maxWidth="max-w-5xl" overlayTint="bg-black/60">

        {/* Header */}
        <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100 shrink-0">
          <div>
            <h2 id="csv-import-title" className="text-xl font-bold text-gray-900">Import z CSV</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 1 && 'Wybierz plik do zaimportowania'}
              {step === 2 && 'Dopasuj kolumny do pól'}
              {step === 3 && `${transactions.length} transakcji do przejrzenia`}
              {step === 4 && 'Import zakończony'}
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Zamknij import CSV"
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto flex-1">

          {/* Step indicator */}
          {step < 4 && <StepIndicator current={step} />}

          {/* Inline error */}
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-5 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} aria-label="Zamknij komunikat błędu" className="text-rose-400 hover:text-rose-600 ml-2 font-bold">&#10005;</button>
            </div>
          )}

          {/* ───────── Step 1: Upload ───────── */}
          {step === 1 && (
            <div className="space-y-5">

              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
                  transition-all duration-200 group
                  ${isDragging
                    ? 'border-indigo-500 bg-indigo-50 scale-[1.01] shadow-lg shadow-indigo-100'
                    : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-md'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Icon */}
                <div className={`
                  mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-200
                  ${isDragging ? 'bg-indigo-100 scale-110' : 'bg-white shadow-sm group-hover:bg-indigo-50 group-hover:scale-105'}
                `}>
                  <svg className={`w-10 h-10 transition-colors ${isDragging ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>

                <h3 className={`text-xl font-semibold mb-1 transition-colors ${isDragging ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {isDragging ? 'Upuść plik tutaj' : 'Przeciągnij plik CSV tutaj'}
                </h3>
                <p className="text-gray-400 text-sm mb-6">lub</p>

                <div className={`
                  inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all
                  ${isDragging
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-600 text-white group-hover:bg-indigo-700 shadow-sm shadow-indigo-200'
                  }
                `}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Wybierz plik z dysku
                </div>

                {selectedFileName && (
                  <p className="mt-4 text-sm text-indigo-600 font-medium">
                    Wybrany: {selectedFileName}
                  </p>
                )}
              </div>

              {/* Supported formats */}
              <div className="flex flex-col gap-1.5">
                {[
                  { icon: <BankIcon />, label: 'Rozpoznawanie automatyczne', desc: 'PKO BP / iPKO, Bank Millennium' },
                  { icon: <TableIcon />, label: 'CSV z nagłówkami', desc: 'standardowy format' },
                  { icon: <ListIcon />, label: 'CSV bez nagłówków', desc: 'mapowanie ręczne' },
                ].map(({ icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="text-indigo-400 leading-none">{icon}</span>
                    <span className="font-medium text-gray-700 whitespace-nowrap">{label}:</span>
                    <span className="text-gray-500 whitespace-nowrap">{desc}</span>
                  </div>
                ))}
              </div>

              {/* AI badge */}
              {aiEnabled && (
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                  <span className="text-violet-500"><SparkleIcon size={18} /></span>
                  <div>
                    <span className="text-sm font-semibold text-violet-700">Kategoryzacja AI włączona</span>
                    <span className="text-xs text-violet-500 ml-2">
                      Transakcje bez dopasowania zostaną automatycznie skategoryzowane przez AI
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ───────── Step 2: Column Mapping ───────── */}
          {step === 2 && (
            <div className="space-y-5">
              {detectedFormat === 'pko_bp' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="text-emerald-500 text-xl mt-0.5">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Wykryto format PKO BP</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Kolumny zostały automatycznie zmapowane, a opisy wyodrębnione z danych bankowych.</p>
                  </div>
                </div>
              )}
              {detectedFormat === 'millennium' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="text-emerald-500 text-xl mt-0.5">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Wykryto format Bank Millennium</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Kolumny Obciążenia/Uznania zmapowane automatycznie. Opisy transakcji kartą oczyszczone z dat i kodów krajów.</p>
                  </div>
                </div>
              )}
              {detectedFormat === 'revolut' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="text-emerald-500 text-xl mt-0.5">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Wykryto format Revolut</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Pominięto operacje w toku i anulowane. Kwoty są w walucie konta — sprawdź przeliczenie przed importem.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { field: 'data', label: 'Data operacji', required: true },
                  { field: 'kwota', label: 'Kwota / Obciążenia', required: true },
                  { field: 'uznania', label: 'Uznania (wpływy)', required: false, hint: 'dla iPKO' },
                  { field: 'opis', label: 'Opis / Notatka', required: false },
                ].map(({ field, label, required, hint }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {label}
                      {required && <span className="text-rose-500 ml-1">*</span>}
                      {hint && <span className="text-gray-400 font-normal ml-1 text-xs">— {hint}</span>}
                    </label>
                    <select
                      value={columnMapping[field] || ''}
                      onChange={e => handleMappingChange(field, e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                    >
                      <option value="">{field === 'uznania' ? 'Brak (jedna kolumna kwoty)' : 'Wybierz kolumnę…'}</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Person selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Osoba <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedOsoba}
                  onChange={e => setSelectedOsoba(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                >
                  <option value="">— Wybierz osobę —</option>
                  {osoby.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Data preview */}
              {csvData && csvData.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
                    Podgląd danych — pierwsze 3 wiersze z {csvData.length}
                  </div>
                  <div className="overflow-auto max-h-40">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {headers.map(h => (
                            <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium text-gray-600 border-b border-gray-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            {headers.map(h => (
                              <td key={h} className="px-3 py-1.5 whitespace-nowrap max-w-[180px] truncate text-gray-500">{row[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700 space-y-1">
                <p>Format daty: YYYY-MM-DD. Kwota ujemna = wydatek, dodatnia = przychód.</p>
                <p>iPKO: Zmapuj „Obciążenia" jako Kwota i „Uznania" jako Uznania.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => { setStep(1); setDetectedFormat(null); }}>
                  ← Wstecz
                </Button>
                <Button className="flex-1" onClick={prepareTransactions}>
                  Dalej →
                </Button>
              </div>
            </div>
          )}

          {/* ───────── Step 3: Preview ───────── */}
          {step === 3 && (
            <div className="space-y-4">

              {/* Header bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg text-gray-800">
                    Podgląd importu
                    <span className="ml-2 text-sm font-normal text-gray-400">({transactions.length})</span>
                  </h3>
                  {unmappedCount > 0 && !aiLoading && (
                    <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                      {unmappedCount} bez kategorii
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {lastSaved && (
                    <span className="text-xs text-gray-500">
                      Zapis: {lastSaved.toLocaleTimeString('pl-PL')}
                    </span>
                  )}
                  <button
                    onClick={() => setShowDetailsColumn(!showDetailsColumn)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      showDetailsColumn
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                        : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {showDetailsColumn ? 'Ukryj szczegóły' : 'Szczegóły CSV'}
                  </button>
                </div>
              </div>

              {/* AI loading indicator */}
              {aiLoading && (
                <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-700">
                  <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span>AI wyszukuje dopasowania kategorii dla nieprzypisanych transakcji…</span>
                </div>
              )}

              {/* AI success badge */}
              {!aiLoading && aiMatchCount > 0 && (
                <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 text-sm text-violet-700">
                  <span className="text-violet-500"><SparkleIcon /></span>
                  AI automatycznie przypisało <strong>{aiMatchCount}</strong> transakcji na podstawie historii kategoryzacji
                </div>
              )}

              {/* Rule notification */}
              {ruleNotification && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-emerald-800">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>
                      <strong>Reguła dodana{aiEnabled ? ' i zapisana w AI' : ''}!</strong>
                      {ruleNotification.matchCount > 0 ? (
                        <> Przypisano <strong>{ruleNotification.matchCount}</strong> transakcji → <strong>{ruleNotification.kategoria}</strong>{ruleNotification.podkategoria && <> &gt; {ruleNotification.podkategoria}</>}</>
                      ) : (
                        <> Brak pasujących nieprzypisanych transakcji</>
                      )}
                    </span>
                  </div>
                  <button onClick={() => setRuleNotification(null)} aria-label="Zamknij powiadomienie o regule" className="text-emerald-400 hover:text-emerald-600 ml-2">✕</button>
                </div>
              )}

              {/* Rozpoznawanie już zaksięgowanych */}
              {dedupInfo && !dedupInfo.dostepny && (
                <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <strong>Nie sprawdzono duplikatów.</strong>{' '}
                  {dedupInfo.powod === 'migracja'
                    ? 'Baza nie ma jeszcze migracji 014 — import zapisze wszystkie wiersze, także te już wgrane.'
                    : 'Nie udało się połączyć z bazą w celu sprawdzenia odcisków. Upewnij się, że ten wyciąg nie był już importowany.'}
                </div>
              )}
              {dedupInfo?.dostepny && (
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtr wierszy importu">
                  {FILTRY_STATUSU.map(({ id, label }) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={filtrStatusu === id}
                      onClick={() => setFiltrStatusu(id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        filtrStatusu === id
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {label} <span className="opacity-75">({liczbyStatusow[id] ?? 0})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Transactions table */}
              <div className="overflow-auto border border-gray-200 rounded-xl max-h-[38vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-[1]">
                    <tr>
                      {dedupInfo?.dostepny && (
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          <span className="sr-only">Importuj</span>✓
                        </th>
                      )}
                      <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                      <th className="px-3 py-2.5 text-right whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Kwota</th>
                      <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Opis</th>
                      <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategoria</th>
                      <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Podkategoria</th>
                      {showDetailsColumn && (
                        <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Szczegóły</th>
                      )}
                      <th className="px-3 py-2.5 text-center whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((tx, idx) => pasujeDoFiltra(tx, filtrStatusu) && (
                      <React.Fragment key={idx}>
                        <tr className={`hover:bg-gray-50/70 transition-colors ${
                          tx._dedup?.wybrana === false
                            ? 'opacity-50'
                            : tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane'
                            ? 'bg-amber-50/40'
                            : ''
                        }`}>
                          {dedupInfo?.dostepny && (
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={tx._dedup?.wybrana !== false}
                                // Zaksięgowana z żywą transakcją: RPC i tak by ją pominęło.
                                disabled={tx._dedup?.status === 'zaksiegowana' && tx._dedup?.istniejacaTransakcja !== null}
                                onChange={e => handleDedupChange(idx, { wybrana: e.target.checked })}
                                aria-label={`Importuj wiersz ${idx + 1}`}
                                className="w-4 h-4 accent-indigo-600"
                              />
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={tx.data}
                              onChange={e => handleEditTransaction(idx, 'data', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full min-w-[130px] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={tx.kwota}
                              onChange={e => {
                                const raw = e.target.value;
                                const normalized = raw.replace(',', '.');
                                if (normalized === '' || normalized === '-' || /^-?\d*\.?\d*$/.test(normalized)) {
                                  handleEditTransaction(idx, 'kwota', normalized);
                                }
                              }}
                              onBlur={e => handleEditTransaction(idx, 'kwota', parseKwota(e.target.value))}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full text-right min-w-[90px] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={tx.opis}
                              onChange={e => handleEditTransaction(idx, 'opis', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full text-sm min-w-[120px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                            {tx._dedup && <DedupInfo dedup={tx._dedup} onChange={zmiany => handleDedupChange(idx, zmiany)} />}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={tx.kategoria}
                              onChange={e => handleEditTransaction(idx, 'kategoria', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full text-sm min-w-[110px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            >
                              {Object.keys(kategorie?.[tx.typ] || {}).map(k => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={tx.podkategoria}
                              onChange={e => handleEditTransaction(idx, 'podkategoria', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full text-sm min-w-[120px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            >
                              {(kategorie?.[tx.typ]?.[tx.kategoria] || []).map(pk => (
                                <option key={pk} value={pk}>{pk}</option>
                              ))}
                            </select>
                          </td>
                          {showDetailsColumn && (
                            <td className="px-3 py-2 hidden md:table-cell">
                              <div className="text-xs text-gray-400 space-y-0.5 max-w-[200px]">
                                {txMeta[idx]?._originalOpis && txMeta[idx]._originalOpis !== tx.opis && (
                                  <div><span className="font-medium text-gray-500">Oryg:</span> {txMeta[idx]._originalOpis}</div>
                                )}
                                {txMeta[idx]?._csvRaw && Object.entries(txMeta[idx]._csvRaw).map(([key, value]) =>
                                  value ? <div key={key} className="truncate"><span className="font-medium text-gray-500">{key}:</span> {value}</div> : null
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {showDetailsColumn && (
                                <button
                                  onClick={() => toggleRowExpand(idx)}
                                  className="md:hidden text-indigo-400 hover:text-indigo-600 text-xs px-1"
                                >
                                  {expandedRows.has(idx) ? '▲' : '▼'}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteTransaction(idx)}
                                aria-label={`Usuń wiersz ${idx + 1} z importu`}
                                className="text-rose-400 hover:text-rose-600 font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-rose-50 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                        {showDetailsColumn && expandedRows.has(idx) && (
                          <tr className="md:hidden border-t bg-gray-50">
                            <td colSpan={dedupInfo?.dostepny ? 8 : 7} className="px-4 py-2 text-xs text-gray-500 space-y-1">
                              {txMeta[idx]?._originalOpis && txMeta[idx]._originalOpis !== tx.opis && (
                                <div><span className="font-medium text-gray-600">Oryginalny opis:</span> {txMeta[idx]._originalOpis}</div>
                              )}
                              {txMeta[idx]?._csvRaw && Object.entries(txMeta[idx]._csvRaw).map(([key, value]) =>
                                value ? <div key={key}><span className="font-medium text-gray-600">{key}:</span> {value}</div> : null
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recognition rules panel */}
              <div className="border border-indigo-200 rounded-xl bg-indigo-50/50 overflow-hidden">
                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-indigo-700 font-semibold text-sm">Reguły rozpoznawania</span>
                    {recognitionRules.length > 0 && (
                      <span className="text-xs bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        {recognitionRules.length}
                      </span>
                    )}
                    {unmappedCount > 0 && (
                      <span className="text-xs text-amber-600 font-medium">
                        {unmappedCount} nieprzypisanych
                      </span>
                    )}
                    {aiEnabled && (
                      <span className="text-xs text-violet-500 flex items-center gap-1">
                        <SparkleIcon size={12} /> Zapisywane w AI
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {recognitionRules.length > 0 && (
                      <button
                        onClick={() => { setShowRulesList(!showRulesList); setShowRuleForm(false); }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-100 transition-colors"
                      >
                        {showRulesList ? 'Ukryj' : 'Lista reguł'}
                      </button>
                    )}
                    <button
                      onClick={() => { setShowRuleForm(!showRuleForm); setShowRulesList(false); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
                    >
                      {showRuleForm ? 'Anuluj' : '+ Dodaj regułę'}
                    </button>
                  </div>
                </div>

                {/* Rules list */}
                {showRulesList && recognitionRules.length > 0 && (
                  <div className="px-4 pb-3 border-t border-indigo-200 pt-3">
                    <div className="space-y-1.5 max-h-32 overflow-auto">
                      {recognitionRules.map((rule, i) => (
                        <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 text-xs border border-indigo-100">
                          <span>
                            Jeśli zawiera „<strong>{rule.keyword}</strong>" →{' '}
                            <span className="text-indigo-600 font-medium">{rule.kategoria}</span>
                            {rule.podkategoria && <> &gt; <span className="text-indigo-500">{rule.podkategoria}</span></>}
                            {rule.typ && <span className="text-gray-400 ml-1">({rule.typ})</span>}
                          </span>
                          <button
                            onClick={() => handleDeleteRule(i)}
                            aria-label={`Usuń regułę „${rule.keyword}"`}
                            className="text-rose-400 hover:text-rose-600 ml-2 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add rule form */}
                {showRuleForm && (
                  <div className="px-4 pb-4 border-t border-indigo-200 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tekst w opisie</label>
                        <input
                          type="text"
                          value={ruleForm.keyword}
                          onChange={e => setRuleForm(prev => ({ ...prev, keyword: e.target.value }))}
                          placeholder="np. Biedronka, Allegro…"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
                        <select
                          value={ruleForm.typ}
                          onChange={e => setRuleForm(prev => ({ ...prev, typ: e.target.value, kategoria: '', podkategoria: '' }))}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        >
                          <option value="Wydatek">Wydatek</option>
                          <option value="Przychód">Przychód</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Kategoria</label>
                        <select
                          value={ruleForm.kategoria}
                          onChange={e => setRuleForm(prev => ({ ...prev, kategoria: e.target.value, podkategoria: '' }))}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        >
                          <option value="">Wybierz…</option>
                          {ruleCategories.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Podkategoria</label>
                        <select
                          value={ruleForm.podkategoria}
                          onChange={e => setRuleForm(prev => ({ ...prev, podkategoria: e.target.value }))}
                          disabled={!ruleForm.kategoria}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:opacity-50"
                        >
                          <option value="">Wybierz…</option>
                          {ruleSubcategories.map(pk => <option key={pk} value={pk}>{pk}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <Button variant="success" size="sm" className="w-full" onClick={handleAddRule}>
                          Dodaj i zastosuj
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Reguła zostanie zastosowana natychmiast i zapisana do przyszłych importów
                      {aiEnabled && ' oraz do bazy wektorowej AI'}.
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom actions */}
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
                  ← Wstecz
                </Button>
                <Button className="flex-1" onClick={handleImport} disabled={isLoading || aiLoading}>
                  {isLoading ? (
                    <>
                      <svg aria-hidden="true" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Importuję…
                    </>
                  ) : (
                    `Importuj ${liczbaDoImportu} transakcji`
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ───────── Step 4: Success ───────── */}
          {step === 4 && (
            <div className="text-center py-8 space-y-5">
              <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">Import zakończony!</h3>
                <p className="text-gray-400 mt-1">
                  Zaimportowano <strong className="text-gray-600">{importRaport?.dodane ?? 0}</strong> transakcji
                </p>
                {importRaport && (importRaport.pominiete > 0 || importRaport.polaczone > 0 || importRaport.dolaczone > 0) && (
                  <ul className="text-sm text-gray-500 mt-2 space-y-0.5">
                    {importRaport.polaczone > 0 && <li>Połączono z fakturami: <strong>{importRaport.polaczone}</strong></li>}
                    {importRaport.dolaczone > 0 && <li>Dołączono do istniejących wpisów: <strong>{importRaport.dolaczone}</strong></li>}
                    {importRaport.pominiete > 0 && <li>Pominięto jako już zaksięgowane: <strong>{importRaport.pominiete}</strong></li>}
                  </ul>
                )}
                {aiEnabled && (
                  <p className="text-xs text-violet-500 mt-2 flex items-center justify-center gap-1">
                    <SparkleIcon size={12} /> Kategorie zapisane w bazie wektorowej AI
                  </p>
                )}
              </div>
              <Button size="lg" onClick={handleClose}>
                Zamknij
              </Button>
            </div>
          )}
        </div>
      </ModalShell>

      {/* Dialog przywracania zapisanego postępu */}
      {restorePrompt && (
        <ConfirmDialog
          title="Przywrócić zapisany postęp?"
          message={`Znaleziono zapisany postęp importu CSV (${restorePrompt.savedTx.length} transakcji). Możesz kontynuować od miejsca, w którym skończono.`}
          confirmLabel="Przywróć"
          cancelLabel="Odrzuć"
          onConfirm={handleRestoreProgress}
          onCancel={handleDiscardProgress}
        />
      )}
    </>
  );
}
