/**
 * Odciski operacji — stabilne identyfikatory w obrębie źródła.
 *
 * Moduł jest czysty (bez Supabase i bez Reacta), więc korzystają z niego
 * zarówno CSVImport.jsx w przeglądarce, jak i skrypty Node w migration/
 * oraz API w api/v1. Odcisk = sha256 (hex) ze znormalizowanych pól
 * połączonych znakiem '|'. Zasady normalizacji (docs/DEDUP_TRANSAKCJI.md):
 *   - numery kont → same cyfry,
 *   - kwoty → grosze jako liczba całkowita, zapis z dwoma miejscami,
 *   - opisy → wielkie litery, pojedyncze spacje.
 *
 * UWAGA: zmiana którejkolwiek normalizacji unieważnia odciski już zapisane
 * w transakcje_dowody — ponowny import tego samego wyciągu przestałby być
 * rozpoznawany. Zmieniaj tylko razem z migracją przeliczającą zrodlo_id.
 */

export const ZRODLA = ['reczne', 'millennium', 'pko', 'revolut', 'csv', 'gmail', 'allegro'];

export const tylkoCyfry = (s) => String(s ?? '').replace(/\D/g, '');

/**
 * Rachunek do HMAC (#130): same cyfry, ostatnie 26 (NRB bez prefiksu kraju).
 * Krótszy → null — nie haszujemy, bo „1234" w wielu rachunkach dałby kolizje
 * z niczym niepowiązanymi kontami.
 */
export function kanonicznyRachunek(s) {
  const cyfry = tylkoCyfry(s);
  return cyfry.length >= 26 ? cyfry.slice(-26) : null;
}

export const normalizujOpis = (s) =>
  String(s ?? '').replace(/[\s\u00a0]+/g, ' ').trim().toUpperCase();

/**
 * Kwota z wyciągu → grosze (liczba całkowita). Przyjmuje formaty bankowe:
 * "-1 234,56", "1.234,56", "-12.50", liczby. Liczymy na stringu, nie na
 * float, żeby 0,1 + 0,2 nie zmieniało odcisku. Zwraca null dla pustych.
 */
export function naGrosze(wartosc) {
  if (wartosc === null || wartosc === undefined || wartosc === '') return null;
  if (typeof wartosc === 'number') {
    return Number.isFinite(wartosc) ? Math.round(wartosc * 100) : null;
  }
  let s = String(wartosc).replace(/[\s\u00a0]/g, '').replace(/(PLN|EUR|USD|GBP|ZŁ)$/i, '');
  if (!s) return null;
  // "1.234,56" → separator tysięcy kropka, dziesiętny przecinek
  if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const m = s.match(/^([+-])?(\d*)(?:\.(\d*))?$/);
  if (!m || (!m[2] && !m[3])) return null;
  const zl = parseInt(m[2] || '0', 10);
  const frac = (m[3] || '').padEnd(3, '0');
  // ROUND_HALF_UP na trzeciej cyfrze po przecinku
  let gr = zl * 100 + parseInt(frac.slice(0, 2), 10) + (parseInt(frac[2], 10) >= 5 ? 1 : 0);
  if (m[1] === '-') gr = -gr;
  return gr;
}

export const groszeNaTekst = (gr) => (gr === null ? '' : (gr / 100).toFixed(2));

export const normalizujKwote = (wartosc) => groszeNaTekst(naGrosze(wartosc));

/** Numer dokumentu do porównań: wielkie litery, bez spacji. */
export const normalizujDokument = (s) =>
  String(s ?? '').replace(/[\s\u00a0]+/g, '').toUpperCase();

// ── Klucze odcisku per źródło ───────────────────────────────────────────────
// Każda funkcja zwraca tekst PRZED haszowaniem. Trzymamy je osobno od sha256,
// żeby testy mogły sprawdzać, które pola wchodzą do odcisku.

export const kluczMillennium = ({ nrRachunku, dataTransakcji, obciazenia, uznania, saldo, opis }) =>
  [
    tylkoCyfry(nrRachunku),
    dataTransakcji,
    // Obciążenia i uznania leżą w osobnych kolumnach — bierzemy tę niepustą.
    normalizujKwote(obciazenia !== '' && obciazenia != null ? obciazenia : uznania),
    normalizujKwote(saldo),
    normalizujOpis(opis),
  ].join('|');

export const kluczPko = ({ dataOperacji, kwota, saldo, opis }) =>
  [dataOperacji, normalizujKwote(kwota), normalizujKwote(saldo), normalizujOpis(opis)].join('|');

export const kluczRevolut = ({ startedDate, amount, balance, description }) =>
  [String(startedDate ?? '').trim(), normalizujKwote(amount), normalizujKwote(balance), normalizujOpis(description)].join('|');

/** Dowolny CSV z ręcznym mapowaniem kolumn — saldo tylko, jeśli zmapowane. */
export const kluczCsv = ({ data, kwota, saldo, opis }) =>
  [data, normalizujKwote(kwota), normalizujKwote(saldo), normalizujOpis(opis)].join('|');

/** Gmail: kontrahent + dokument, NIE messageId (ta sama faktura bywa wysłana 2×). */
export const kluczGmail = ({ kontrahent, dokument }) =>
  `${String(kontrahent ?? '').trim().toLowerCase()}|${normalizujDokument(dokument)}`;

/** Allegro: grupa płatności + zamówienie (references/allegro.md w skillu). */
export const kluczAllegro = ({ paymentId, orderId }) => `${paymentId}|${orderId}`;

/**
 * Dwa identyczne wiersze w jednym pliku (bez salda, które by je rozróżniło)
 * dostają sufiks #2, #3… Kolejność wierszy w eksporcie jest stała, więc
 * ponowne wgranie tego samego pliku daje te same sufiksy. Pierwsze wystąpienie
 * zostaje bez sufiksu, żeby odcisk wiersza unikalnego nie zależał od reszty pliku.
 */
export function rozroznijPowtorzenia(klucze) {
  const licznik = new Map();
  return klucze.map((k) => {
    if (k === null || k === undefined) return k;
    const n = (licznik.get(k) || 0) + 1;
    licznik.set(k, n);
    return n === 1 ? k : `${k}#${n}`;
  });
}

export async function sha256Hex(tekst) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Brak Web Crypto (crypto.subtle) — wymagany HTTPS lub Node 18+');
  const bufor = await subtle.digest('SHA-256', new TextEncoder().encode(tekst));
  return Array.from(new Uint8Array(bufor), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const odcisk = (klucz) => sha256Hex(klucz);

// ── Podział z rodzicami ─────────────────────────────────────────────────────

export const UDZIAL_RE = /\[udział (\d+\/\d+) z ([\d\s\u00a0]+,\d{2}) zł\]/;

/** "1/2" → [1, 2]; null dla braku lub błędnego zapisu. */
export function parsujUlamek(udzial) {
  const m = String(udzial ?? '').match(/^(\d+)\/(\d+)$/);
  if (!m) return null;
  const [l, m2] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  return m2 > 0 && l > 0 && l <= m2 ? [l, m2] : null;
}

/**
 * Udział gospodarstwa w groszach, ROUND_HALF_UP na liczbach całkowitych
 * (skill: nigdy na float). 26547 gr × 1/2 → 13274 gr (132,735 → 132,74).
 */
export function udzialWGroszach(bruttoGr, udzial) {
  const u = parsujUlamek(udzial);
  if (!u) return bruttoGr;
  const [l, m] = u;
  const znak = bruttoGr < 0 ? -1 : 1;
  return znak * Math.floor((Math.abs(bruttoGr) * l * 2 + m) / (2 * m));
}

const formatPl = (gr) =>
  (Math.abs(gr) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Ślad w komentarzu: "[udział 1/2 z 265,47 zł]". */
export const znacznikUdzialu = (udzial, bruttoGr) => `[udział ${udzial} z ${formatPl(bruttoGr)} zł]`;

/** Odczyt śladu z komentarza → { udzial, kwotaPelna } albo null. */
export function odczytajUdzial(komentarz) {
  const m = String(komentarz ?? '').match(UDZIAL_RE);
  if (!m) return null;
  return { udzial: m[1], kwotaPelna: naGrosze(m[2]) / 100 };
}
