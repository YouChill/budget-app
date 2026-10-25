/**
 * Kształt pozycji dla RPC public.importuj_transakcje (migracja 014).
 *
 * Wspólny dla CSVImport (przez api.importujTransakcje), /api/v1/transakcje
 * i migration/import_do_aplikacji.mjs — wszystkie trzy wysyłają płaskie
 * rekordy transakcji, a ten moduł rozdziela je na dowód i transakcję.
 */

const zaokr = (n) => Math.round(n * 100) / 100;

/**
 * rekord: {
 *   data, typ, kwota, kategoria, podkategoria?, osoba, komentarz? | opis?,
 *   kwota_pelna?, udzial?,                     — podział z rodzicami
 *   zrodlo?, zrodlo_id?, dokument?, kontrahent?, surowe?, data_dowodu?,
 *   zobowiazanie_id?, transakcja_id?, do_weryfikacji?, wymus?
 * }
 * Bez zrodlo_id pozycja nie ma dowodu — to zwykły wpis (jak ręczny).
 * Z transakcja_id pozycja nie tworzy transakcji, tylko dołącza do niej dowód.
 */
export function pozycjaZRekordu(r) {
  const kwota = Math.abs(Number(r.kwota));
  const typ = r.typ || (Number(r.kwota) < 0 ? 'Wydatek' : 'Przychód');
  const kwotaPelna = r.kwota_pelna !== undefined && r.kwota_pelna !== null && r.kwota_pelna !== ''
    ? Math.abs(Number(r.kwota_pelna))
    : null;

  const pozycja = {
    dowod: null,
    transakcja: null,
    transakcja_id: r.transakcja_id ?? null,
    zobowiazanie_id: r.zobowiazanie_id ?? null,
    do_weryfikacji: !!r.do_weryfikacji,
    wymus: !!r.wymus,
  };

  if (r.zrodlo_id) {
    // Dowód trzyma kwotę brutto ze źródła ze znakiem przepływu.
    const brutto = kwotaPelna ?? kwota;
    pozycja.dowod = {
      zrodlo: r.zrodlo || 'csv',
      zrodlo_id: String(r.zrodlo_id),
      data: r.data_dowodu || r.data,
      kwota_pelna: zaokr(typ === 'Wydatek' ? -brutto : brutto),
      kontrahent: r.kontrahent ?? null,
      dokument: r.dokument ?? null,
      surowe: r.surowe ?? null,
    };
  }

  if (!pozycja.transakcja_id) {
    pozycja.transakcja = {
      data: r.data,
      typ,
      kwota: zaokr(kwota),
      kategoria: r.kategoria,
      podkategoria: r.podkategoria || null,
      osoba: r.osoba,
      komentarz: r.komentarz || r.opis || null,
      kwota_pelna: kwotaPelna === null ? null : zaokr(kwotaPelna),
      udzial: r.udzial || null,
    };
  }

  return pozycja;
}

/**
 * Kody błędów brakującej funkcji/tabeli — migracji jeszcze nie wdrożono.
 * `nazwa` (funkcja RPC albo tabela) dopasowuje też komunikat PostgREST.
 */
export function brakMigracji(error, nazwa) {
  if (!error) return false;
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code)) return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes(nazwa) && msg.includes('could not find');
}

/** Kody błędów, po których wiadomo, że migracji 014 jeszcze nie wdrożono. */
export const brakMigracji014 = (error) => brakMigracji(error, 'importuj_transakcje');
