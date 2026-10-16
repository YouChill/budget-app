import {
  tylkoCyfry,
  kluczMillennium,
  kluczPko,
  kluczRevolut,
} from '../odciski';
import { normalizeDateToISO } from './parsowanie';

// ─── PKO BP format detection & parsing ───────────────────────────────────────
export const detectPkoBpFormat = (firstRow) => {
  if (!firstRow || !Array.isArray(firstRow) || firstRow.length < 7) return false;
  return (
    firstRow[0]?.trim() === 'Data operacji' &&
    firstRow[3]?.trim() === 'Kwota' &&
    firstRow[6]?.trim() === 'Opis transakcji'
  );
};

export const extractPkoBpDescription = (row) => {
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
export const detectMillenniumFormat = (firstRow) => {
  if (!firstRow || !Array.isArray(firstRow) || firstRow.length < 9) return false;
  return (
    firstRow[1]?.trim() === 'Data transakcji' &&
    firstRow[3]?.trim() === 'Rodzaj transakcji' &&
    firstRow[7]?.trim() === 'Obciążenia' &&
    firstRow[8]?.trim() === 'Uznania'
  );
};

export const extractMillenniumDescription = (row) => {
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
    const opisIsJustRef = !opis || /^[\d\s/-]+$/.test(opis);
    return opisIsJustRef ? odbiorca : `${odbiorca} — ${opis}`;
  }

  return opis || rodzaj;
};

// ─── Revolut format detection ────────────────────────────────────────────────
// Headers: Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
export const detectRevolutFormat = (firstRow) => {
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

/**
 * Rozpoznaje format wyciągu (PKO BP, Millennium, Revolut, dowolny CSV z/bez
 * nagłówków) i zamienia wiersze z Papa.parse na obiekty kolumna → wartość.
 * Formaty bankowe dostają gotowe mapowanie kolumn i dane odcisku (`__zrodlo`).
 *
 * Zwraca { csvData, headers, detectedFormat, columnMapping | null }
 * albo null, gdy plik ma mniej niż 2 wiersze.
 */
export const wczytajWiersze = (results) => {
  if (!results.data || results.data.length < 2) return null;

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
    return {
      csvData: processed,
      headers: ['Data operacji', 'Data waluty', 'Typ transakcji', 'Kwota', 'Waluta', 'Saldo po transakcji', 'Opis (wyodrębniony)', 'Opis oryginalny'],
      detectedFormat: 'pko_bp',
      columnMapping: { data: 'Data operacji', kwota: 'Kwota', uznania: null, opis: 'Opis (wyodrębniony)' },
    };
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
    return {
      csvData: processed,
      headers: ['Data transakcji', 'Rodzaj transakcji', 'Na konto/Z konta', 'Odbiorca/Zleceniodawca', 'Opis', 'Obciążenia', 'Uznania', 'Saldo', 'Waluta', 'Opis (wyodrębniony)'],
      detectedFormat: 'millennium',
      columnMapping: { data: 'Data transakcji', kwota: 'Obciążenia', uznania: 'Uznania', opis: 'Opis (wyodrębniony)' },
    };
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
    return {
      csvData: processed,
      headers: ['Data', 'Kwota', 'Opis', 'Typ', 'Waluta', 'Saldo'],
      detectedFormat: 'revolut',
      columnMapping: { data: 'Data', kwota: 'Kwota', uznania: null, opis: 'Opis' },
    };
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
      return {
        csvData: processed,
        headers: headerRow.map((h, i) => h?.trim() || `Kolumna ${i + 1}`),
        detectedFormat: null,
        columnMapping: null,
      };
    } else {
      const generatedHeaders = firstRow.map((_, i) => `Kolumna ${i + 1}`);
      const processed = results.data.map(row => {
        const obj = {};
        generatedHeaders.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
      });
      return {
        csvData: processed,
        headers: generatedHeaders,
        detectedFormat: null,
        columnMapping: null,
      };
    }
  }
};
