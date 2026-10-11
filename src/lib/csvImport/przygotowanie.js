import { naGrosze, kluczCsv, udzialWGroszach, znacznikUdzialu } from '../odciski';
import { categorizeDescription, validateCategoryExists } from './kategoryzacja';
import { normalizeDateToISO, parseKwota } from './parsowanie';

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

/**
 * Krok 2 → 3: wiersze CSV + mapowanie kolumn → transakcje podglądu.
 * Kolumna obciążeń = wydatek (zawsze ujemny), uznań = przychód; kategoria
 * ze słów kluczowych i reguł użytkownika, dopasowana do słownika. Wiersze
 * z nieprawidłową datą są pomijane (liczone w `pominiete`).
 *
 * Zwraca { transakcje, meta, pominiete }; meta[i] należy do transakcje[i]
 * (oryginalny opis i pozostałe kolumny CSV do kolumny „Szczegóły").
 */
export const przygotujTransakcje = ({ csvData, headers, columnMapping, rules = [], kategorie }) => {
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

      const categoryData = categorizeDescription(opis, rules, typ);
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

  const transakcje = processedWithMeta.map(x => x.tx);
  const meta = {};
  processedWithMeta.forEach((x, i) => { meta[i] = x.meta; });
  return { transakcje, meta, pominiete: skipped };
};

/**
 * Edycja pola wiersza podglądu. Zmiana kwoty utrzymuje typ zgodny ze znakiem,
 * aby listy kategorii/podkategorii (filtrowane po typ) pozostały spójne.
 */
export const edytujPole = (tx, field, value) => {
  const updated = { ...tx, [field]: value };
  if (field === 'kwota') {
    const num = typeof value === 'number' ? value : parseKwota(value);
    if (!isNaN(num) && num !== 0) updated.typ = num < 0 ? 'Wydatek' : 'Przychód';
  }
  return updated;
};

/**
 * Meta po usunięciu wiersza `index`: kolejne klucze przesuwają się w dół,
 * żeby pozostały wyrównane do zwartych indeksów tablicy transakcji.
 */
export const usunZMeta = (meta, index) => {
  const keys = Object.keys(meta).map(Number).sort((a, b) => a - b);
  const next = {};
  let newIdx = 0;
  for (const k of keys) {
    if (k === index) continue;
    next[newIdx] = meta[k];
    newIdx++;
  }
  return next;
};

/** Liczba wierszy w każdym statusie rozpoznawania (+ `wszystkie`). */
export const liczStatusy = (transakcje) =>
  transakcje.reduce((acc, tx) => {
    const st = tx._dedup?.status ?? 'nowa';
    acc[st] = (acc[st] || 0) + 1;
    acc.wszystkie = (acc.wszystkie || 0) + 1;
    return acc;
  }, {});

/** Wiersz bez dopasowanej kategorii (domyślne Inne/Nieprzewidziane). */
export const bezKategorii = (tx) => tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane';
