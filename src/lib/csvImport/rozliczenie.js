/**
 * Rozliczanie kolejki importu (#132) — czyste funkcje widoku „Do rozliczenia".
 *
 * Wiersz kolejki (transakcje_dowody w statusie 'nowy') → transakcja podglądu
 * z propozycją kategorii (reguły → słownik → dopasowanie do słownika
 * gospodarstwa) i wynikiem parowania (zobowiązania, podobne wpisy ręczne).
 * Propozycje żyją tylko w pamięci — w bazie nic się nie zapisuje do chwili
 * zatwierdzenia (RPC kolejka_zatwierdz).
 */
import { naGrosze, udzialWGroszach, znacznikUdzialu, UDZIAL_RE } from '../odciski';
import { parujPartie } from '../parowanie';
import { categorizeDescription, validateCategoryExists } from './kategoryzacja';
import { bezKategorii, zastosujParowanie } from './przygotowanie';

/**
 * Dowody z bazy → transakcje podglądu. Kwota transakcji startuje od brutto
 * z wyciągu (ze znakiem), kategoria z reguł i słownika.
 */
export function wierszeZKolejki(dowody, { rules = [], kategorie = {} } = {}) {
  return dowody.map((d) => {
    const kwota = Number(d.kwota_pelna);
    const typ = kwota < 0 ? 'Wydatek' : 'Przychód';
    const opis = d.opis ?? '';
    const propozycja = categorizeDescription(opis, rules, typ);
    const { kategoria, podkategoria } = validateCategoryExists(
      propozycja?.kategoria || 'Inne', propozycja?.podkategoria || 'Nieprzewidziane', kategorie, typ, opis
    );
    return {
      dowodId: d.id,
      data: d.data,
      kwota,
      typ,
      opis,
      kategoria,
      podkategoria,
      osoba: d.osoba ?? '',
      _dowod: {
        zrodlo: d.zrodlo,
        data: d.data,
        kwotaPelna: kwota,
        kontrahent: d.kontrahent ?? null,
        dokument: d.dokument ?? null,
        rachunekHmac: d.rachunek_hmac ?? null,
      },
      _dedup: { status: 'nowa', wybrana: true, akcja: 'nowa', reczne: [], kandydaci: [] },
    };
  });
}

/**
 * Parowanie z zobowiązaniami i wpisami bez dowodu (kontekst z
 * api.getKontekstParowania z aliasami po HMAC). Domyślne zaznaczenie:
 * wiersze z kategorią inną niż Inne/Nieprzewidziane.
 */
export function zastosujPropozycje(lista, kontekst, kategorie) {
  const wiersze = lista.map((tx) => ({
    zrodloId: null,
    data: tx.data,
    typ: tx.typ,
    kwotaGr: Math.abs(naGrosze(tx.kwota)),
    opis: tx.opis,
    tytul: '',
    rachunek: '',
    rachunekHmac: tx._dowod.rachunekHmac,
    kontrahent: tx._dowod.kontrahent,
  }));
  const sparowane = kontekst
    ? zastosujParowanie(lista, parujPartie(wiersze, kontekst), kategorie)
    : lista;
  return sparowane.map((tx) => ({ ...tx, _dedup: { ...tx._dedup, wybrana: !bezKategorii(tx) } }));
}

/**
 * Udział gospodarstwa (np. '1/2') z brutto dowodu — jak zastosujParowanie:
 * kwota = udział (ROUND_HALF_UP na groszach), ślad „[udział 1/2 z … zł]"
 * w opisie. Pusty udział przywraca brutto.
 */
export function ustawUdzial(tx, udzial) {
  const bruttoGr = Math.abs(naGrosze(tx._dowod.kwotaPelna));
  const znak = tx.typ === 'Wydatek' ? -1 : 1;
  const opisBez = String(tx.opis ?? '').replace(UDZIAL_RE, '').replace(/\s+$/, '');
  if (!udzial) {
    return { ...tx, kwota: (znak * bruttoGr) / 100, opis: opisBez, _dedup: { ...tx._dedup, udzial: null, kwotaPelna: null } };
  }
  return {
    ...tx,
    kwota: (znak * udzialWGroszach(bruttoGr, udzial)) / 100,
    opis: `${opisBez} ${znacznikUdzialu(udzial, bruttoGr)}`.trim(),
    _dedup: { ...tx._dedup, udzial, kwotaPelna: bruttoGr / 100 },
  };
}

/** Filtr listy: status parowania, miesiąc (YYYY-MM) i źródło. */
export function pasujeDoFiltrow(tx, { status = 'wszystkie', miesiac = '', zrodlo = '' } = {}) {
  if (status !== 'wszystkie' && (tx._dedup?.status ?? 'nowa') !== status) return false;
  if (miesiac && !tx.data.startsWith(miesiac)) return false;
  if (zrodlo && tx._dowod.zrodlo !== zrodlo) return false;
  return true;
}

/**
 * Pozycje RPC kolejka_zatwierdz z zaznaczonych wierszy. „To ten sam wpis"
 * dołącza dowód do istniejącej transakcji (bez tworzenia nowej).
 */
export function pozycjeZatwierdzenia(lista) {
  return lista.map((tx) => {
    const d = tx._dedup ?? {};
    const pozycja = { dowod_id: tx.dowodId, zobowiazanie_id: d.zobowiazanie?.id ?? null };
    if (d.akcja === 'dolacz' && d.dolaczDo) {
      return { ...pozycja, transakcja: null, transakcja_id: d.dolaczDo };
    }
    return {
      ...pozycja,
      transakcja_id: null,
      transakcja: {
        data: tx.data,
        typ: tx.typ,
        kwota: Math.abs(naGrosze(tx.kwota)) / 100,
        kategoria: tx.kategoria,
        podkategoria: tx.podkategoria || null,
        osoba: tx.osoba,
        komentarz: tx.opis || null,
        kwota_pelna: d.udzial ? d.kwotaPelna : null,
        udzial: d.udzial || null,
      },
    };
  });
}

/** Miesiące (YYYY-MM) obecne w kolejce — do filtra, od najnowszego. */
export const miesiaceKolejki = (lista) => [...new Set(lista.map((tx) => tx.data.slice(0, 7)))].sort().reverse();

/** Źródła obecne w kolejce — do filtra. */
export const zrodlaKolejki = (lista) => [...new Set(lista.map((tx) => tx._dowod.zrodlo))].sort();
