import { kanonicznyRachunek, naGrosze, rozroznijPowtorzenia, sha256Hex } from '../odciski';
import { rozpoznajKontrahenta } from '../parowanie';

export const MAX_OPIS = 1000;

/**
 * HMAC tylko dla rachunków kanonicznych (≥ 26 cyfr) — reszta nie opuszcza
 * przeglądarki wcale. `hmacRachunkow` to api.hmacRachunkow (wstrzykiwane,
 * żeby moduł został czysty i testowalny).
 */
export async function hmacDlaWierszy(rachunki, hmacRachunkow) {
  const indeksy = [];
  const doWyslania = [];
  rachunki.forEach((r, i) => {
    if (kanonicznyRachunek(r)) {
      indeksy.push(i);
      doWyslania.push(r);
    }
  });
  const wynik = new Array(rachunki.length).fill(null);
  if (doWyslania.length === 0) return wynik;
  const hmac = await hmacRachunkow(doWyslania);
  indeksy.forEach((i, j) => { wynik[i] = hmac[j] ?? null; });
  return wynik;
}

/**
 * Transakcje z przygotujTransakcje() → pozycje RPC kolejka_dodaj (#131).
 *
 * Do bazy trafia: zrodlo, zrodlo_id (odcisk jak przy imporcie z 014), data,
 * kwota_pelna ze znakiem, opis (≤ 1000 znaków), osoba, kontrahent z aliasów
 * — rozpoznany na pełnym rachunku w pamięci — surowe (tylko 4 ostatnie
 * cyfry kont) i rachunek_hmac. Pełny numer rachunku nie trafia do pozycji.
 */
export async function pozycjeKolejki(lista, { osoba, aliasy = [], hmacRachunkow }) {
  const klucze = rozroznijPowtorzenia(lista.map(tx => tx._zrodlo.klucz));
  const odciski = await Promise.all(klucze.map(k => sha256Hex(k)));
  const hmac = await hmacDlaWierszy(lista.map(tx => tx._zrodlo.rachunek), hmacRachunkow);

  return lista.map((tx, i) => {
    const z = tx._zrodlo;
    return {
      zrodlo: z.zrodlo,
      zrodlo_id: odciski[i],
      data: tx.data,
      kwota_pelna: naGrosze(tx.kwota) / 100,
      opis: String(tx.opis ?? '').trim().slice(0, MAX_OPIS) || null,
      osoba,
      kontrahent: rozpoznajKontrahenta({ rachunek: z.rachunek, opis: tx.opis, tytul: z.tytul }, aliasy),
      surowe: z.surowe ?? null,
      rachunek_hmac: hmac[i],
    };
  });
}
