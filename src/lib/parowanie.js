/**
 * Parowanie wierszy wyciągu z już znanymi operacjami (kaskada z
 * docs/DEDUP_TRANSAKCJI.md, sekcja 5).
 *
 *   1. odcisk istnieje                 → 'zaksiegowana' (pomiń)
 *   2. nr dokumentu w tytule przelewu  → 'polaczona' z zobowiązaniem
 *   3. kontrahent + kwota + okno dat   → 'polaczona', jeśli kandydat jest dokładnie jeden
 *   4. wielu kandydatów / brak kontrahenta przy zgodnej kwocie → 'do_weryfikacji'
 *   5. podobny wpis bez dowodu (ręczny) → ostrzeżenie, decyzja użytkownika
 *
 * Moduł jest czysty — dostaje dane z bazy jako argumenty. Zapis (dowody,
 * transakcje, zamknięcie zobowiązań) robi RPC public.importuj_transakcje.
 */
import { normalizujOpis, normalizujDokument, tylkoCyfry, naGrosze, udzialWGroszach } from './odciski.js';

const DZIEN = 86_400_000;
const dni = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DZIEN;
const roznicaDni = (a, b) => dni(a) - dni(b);

// Najkrótszy numer dokumentu, który uznajemy za rozpoznany w tytule. Krótsze
// („123") trafiałyby przypadkiem w numery referencyjne banku.
const MIN_DOKUMENT = 5;
const MIN_RACHUNEK = 10;

// Udziały sprawdzane przy szukaniu wpisów ręcznych — wpis mógł zostać
// zrobiony już po podziale (skill: prąd/woda/telefon 1/2, śmieci 4/6).
const TYPOWE_UDZIALY = ['1/2', '4/6'];

/**
 * Rozpoznaje kontrahenta: dla przelewów po numerze rachunku (same cyfry,
 * jak wykluczenia w skillu), dla kart po aliasie w opisie. Wiersz z kolejki
 * nie ma już pełnego rachunku, tylko rachunekHmac (#130) — wtedy porównujemy
 * go z wzorzecHmac aliasu (api.zHmacAliasow).
 */
export function rozpoznajKontrahenta(wiersz, aliasy = []) {
  const rachunek = tylkoCyfry(wiersz.rachunek);
  if (!rachunek && wiersz.rachunekHmac) {
    const trafienie = aliasy.find((a) => a.typ_wzorca === 'rachunek' && a.wzorzecHmac === wiersz.rachunekHmac);
    if (trafienie) return trafienie.kontrahent;
  }
  if (rachunek) {
    // Pełny NRB ma 26 cyfr; w wyciągu bywa z prefiksem kraju, więc porównujemy
    // końcówkę — ale nie krótszą niż MIN_RACHUNEK, bo „7777" pasuje do wszystkiego.
    const trafienie = aliasy.find((a) => {
      const wzorzec = tylkoCyfry(a.wzorzec);
      return a.typ_wzorca === 'rachunek' && wzorzec.length >= MIN_RACHUNEK && rachunek.endsWith(wzorzec);
    });
    if (trafienie) return trafienie.kontrahent;
  }
  const opis = normalizujOpis(`${wiersz.opis ?? ''} ${wiersz.tytul ?? ''}`);
  const alias = aliasy.find((a) => a.typ_wzorca === 'opis' && a.wzorzec && opis.includes(normalizujOpis(a.wzorzec)));
  return alias ? alias.kontrahent : null;
}

/**
 * Okno dat, w którym bank może zaksięgować płatność zobowiązania.
 *   przelew:   [wystawienie, termin + 10]
 *   auto_karta:[odnowienie − 1, odnowienie + 4]  (termin = dzień odnowienia)
 * Zwraca [od, do] w dniach od epoki albo null, gdy brak dat.
 */
export function oknoZobowiazania(z) {
  if (z.sposob === 'auto_karta') {
    return z.termin ? [dni(z.termin) - 1, dni(z.termin) + 4] : null;
  }
  const od = z.data_wystawienia ?? null;
  const termin = z.termin ?? null;
  if (!od && !termin) return null;
  return [
    od ? dni(od) : dni(termin) - 30,
    termin ? dni(termin) + 10 : dni(od) + 40,
  ];
}

const wOknie = (z, data) => {
  const okno = oknoZobowiazania(z);
  return !!okno && dni(data) >= okno[0] && dni(data) <= okno[1];
};

const kwotaZobowiazaniaGr = (z) => (z.kwota_pelna === null || z.kwota_pelna === undefined ? null : naGrosze(z.kwota_pelna));

/** Kroki 2–4 dla jednego wiersza (bez konfliktów w obrębie partii). */
function parujWiersz(w, otwarte, aliasy) {
  if (w.typ !== 'Wydatek') return { status: 'nowa' };

  // 2. Numer dokumentu w tytule / opisie
  const tekst = normalizujDokument(`${w.tytul ?? ''} ${w.opis ?? ''}`);
  const poDokumencie = otwarte.filter((z) => {
    const dok = normalizujDokument(z.dokument);
    return dok.length >= MIN_DOKUMENT && tekst.includes(dok);
  });
  if (poDokumencie.length === 1) {
    return { status: 'polaczona', zobowiazanie: poDokumencie[0], powod: 'dokument' };
  }
  if (poDokumencie.length > 1) {
    return { status: 'do_weryfikacji', kandydaci: poDokumencie, powod: 'wiele_dokumentow' };
  }

  // 3. Kontrahent + kwota brutto + okno dat
  const kontrahent = rozpoznajKontrahenta(w, aliasy);
  const zgodne = otwarte.filter((z) => kwotaZobowiazaniaGr(z) === w.kwotaGr && wOknie(z, w.data));

  if (kontrahent) {
    const kandydaci = zgodne.filter((z) => z.kontrahent === kontrahent);
    if (kandydaci.length === 1) {
      return { status: 'polaczona', zobowiazanie: kandydaci[0], powod: 'kontrahent', kontrahent };
    }
    if (kandydaci.length > 1) {
      return { status: 'do_weryfikacji', kandydaci, powod: 'wielu_kandydatow', kontrahent };
    }
    return { status: 'nowa', kontrahent };
  }

  // 4. Brak kontrahenta — zgodna kwota to tylko podpowiedź, nigdy połączenie.
  if (zgodne.length > 0) {
    return { status: 'do_weryfikacji', kandydaci: zgodne, powod: 'brak_kontrahenta' };
  }
  return { status: 'nowa' };
}

/** 5. Wpisy bez dowodu (ręczne lub sprzed odcisków) podobne do wiersza. */
export function znajdzPodobneReczne(w, bezDowodu, udzial = null) {
  const kwoty = new Set([w.kwotaGr]);
  for (const u of [udzial, ...TYPOWE_UDZIALY]) if (u) kwoty.add(udzialWGroszach(w.kwotaGr, u));
  return bezDowodu.filter(
    (t) =>
      (!t.typ || t.typ === w.typ) &&
      Math.abs(roznicaDni(t.data, w.data)) <= 2 &&
      kwoty.has(naGrosze(t.kwota))
  );
}

/**
 * Paruje całą partię wierszy.
 *
 * wiersze:  [{ zrodloId, data, typ, kwotaGr (>0, brutto), opis, tytul, rachunek }]
 * kontekst: { istniejace: Set<zrodloId>, zobowiazania: [otwarte], aliasy, bezDowodu }
 *
 * Zwraca tablicę wyników w kolejności wierszy:
 *   { status, zobowiazanie?, kandydaci?, powod?, kontrahent?, reczne: [] }
 */
export function parujPartie(wiersze, kontekst = {}) {
  const istniejace = kontekst.istniejace ?? new Set();
  // Zobowiązanie zamknięte mailem z potwierdzeniem wpłaty (status 'oplacone',
  // bez transakcji) nadal czeka na wiersz z banku — to on tworzy wydatek.
  const otwarte = (kontekst.zobowiazania ?? []).filter((z) => {
    const status = z.status ?? 'otwarte';
    return status === 'otwarte' || (status === 'oplacone' && !z.transakcja_id);
  });
  const aliasy = kontekst.aliasy ?? [];
  const bezDowodu = kontekst.bezDowodu ?? [];

  const wyniki = wiersze.map((w) =>
    w.zrodloId && istniejace.has(w.zrodloId)
      ? { status: 'zaksiegowana' }
      : parujWiersz(w, otwarte, aliasy)
  );

  // Jedno zobowiązanie może zamknąć tylko jeden wiersz. Gdy dwa wiersze
  // z partii wskazują to samo — żaden nie jest pewny.
  const zajete = new Map();
  wyniki.forEach((r, i) => {
    if (r.status !== 'polaczona') return;
    const id = r.zobowiazanie.id;
    zajete.set(id, [...(zajete.get(id) ?? []), i]);
  });
  for (const indeksy of zajete.values()) {
    if (indeksy.length < 2) continue;
    for (const i of indeksy) {
      const z = wyniki[i].zobowiazanie;
      wyniki[i] = { status: 'do_weryfikacji', kandydaci: [z], powod: 'konflikt_w_partii', kontrahent: wyniki[i].kontrahent };
    }
  }

  return wyniki.map((r, i) => {
    if (r.status === 'zaksiegowana') return { ...r, reczne: [] };
    return { ...r, reczne: znajdzPodobneReczne(wiersze[i], bezDowodu, r.zobowiazanie?.udzial) };
  });
}
