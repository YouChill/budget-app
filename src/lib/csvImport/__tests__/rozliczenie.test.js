import { describe, it, expect } from 'vitest';
import {
  wierszeZKolejki,
  zastosujPropozycje,
  ustawUdzial,
  pasujeDoFiltrow,
  pozycjeZatwierdzenia,
  miesiaceKolejki,
} from '../rozliczenie';

// Rozliczanie kolejki (#132): propozycje z reguł/słownika, parowanie
// z zobowiązaniami, udział i payload kolejka_zatwierdz.

const kategorie = {
  Wydatek: { Jedzenie: ['Zakupy domowe'], Rachunki: ['Telefon'], Inne: ['Nieprzewidziane'] },
  Przychód: { 'Inne przychody': ['Zwroty'] },
};

const dowod = (over = {}) => ({
  id: 'd1', zrodlo: 'millennium', data: '2026-10-04', kwota_pelna: -119.98,
  opis: 'PRZELEW F/60345080/09/26', osoba: 'Teresa', kontrahent: null, dokument: null,
  rachunek_hmac: null, status: 'nowy', ...over,
});

const play = {
  id: 'z-play', kontrahent: 'play', dokument: 'F/60345080/09/26', kwota_pelna: 119.98,
  termin: '2026-10-05', kategoria: 'Rachunki', podkategoria: 'Telefon', udzial: '1/2', status: 'otwarte',
};

describe('wierszeZKolejki', () => {
  it('propozycja z reguł użytkownika ma pierwszeństwo przed słownikiem', () => {
    const rules = [{ keyword: 'biedronka', typ: 'Wydatek', kategoria: 'Rachunki', podkategoria: 'Telefon' }];
    const [a, b] = wierszeZKolejki([
      dowod({ id: 'a', opis: 'BIEDRONKA 123', kwota_pelna: -45.1 }),
      dowod({ id: 'b', opis: 'LIDL SP. Z O.O.', kwota_pelna: -20 }),
    ], { rules, kategorie });
    expect([a.kategoria, a.podkategoria]).toEqual(['Rachunki', 'Telefon']);
    expect([b.kategoria, b.podkategoria]).toEqual(['Jedzenie', 'Zakupy domowe']);
    expect(a).toMatchObject({ dowodId: 'a', kwota: -45.1, typ: 'Wydatek', osoba: 'Teresa' });
  });

  it('bez dopasowania: Inne / Nieprzewidziane; przychód — kategoria przychodowa', () => {
    const [w, p] = wierszeZKolejki([
      dowod({ opis: 'XYZ' }),
      dowod({ id: 'p', opis: 'ZWROT', kwota_pelna: 30 }),
    ], { kategorie });
    expect([w.kategoria, w.podkategoria]).toEqual(['Inne', 'Nieprzewidziane']);
    expect(p).toMatchObject({ typ: 'Przychód', kategoria: 'Inne przychody' });
  });
});

describe('zastosujPropozycje', () => {
  it('wiersz pasujący do zobowiązania dostaje kategorię i udział', () => {
    const [w] = zastosujPropozycje(
      wierszeZKolejki([dowod()], { kategorie }),
      { zobowiazania: [play], aliasy: [], bezDowodu: [] },
      kategorie
    );
    expect(w).toMatchObject({ kategoria: 'Rachunki', podkategoria: 'Telefon', kwota: -59.99 });
    expect(w.opis).toContain('[udział 1/2 z 119,98 zł]');
    expect(w._dedup).toMatchObject({ status: 'polaczona', udzial: '1/2', kwotaPelna: 119.98, wybrana: true });
    expect(w._dedup.zobowiazanie.id).toBe('z-play');
  });

  it('kontrahent po HMAC rachunku (alias z wzorzecHmac) łączy z zobowiązaniem bez numeru dokumentu', () => {
    const [w] = zastosujPropozycje(
      wierszeZKolejki([dowod({ opis: 'OPŁATA', rachunek_hmac: 'a'.repeat(64) })], { kategorie }),
      { zobowiazania: [play], aliasy: [{ typ_wzorca: 'rachunek', wzorzec: 'x', wzorzecHmac: 'a'.repeat(64), kontrahent: 'play' }], bezDowodu: [] },
      kategorie
    );
    expect(w._dedup).toMatchObject({ status: 'polaczona', powod: 'kontrahent' });
  });

  it('domyślnie zaznaczone tylko wiersze z kategorią ≠ Inne/Nieprzewidziane', () => {
    const lista = zastosujPropozycje(
      wierszeZKolejki([dowod({ id: 'a', opis: 'BIEDRONKA' }), dowod({ id: 'b', opis: 'XYZ' })], { kategorie }),
      null,
      kategorie
    );
    expect(lista.map(t => t._dedup.wybrana)).toEqual([true, false]);
  });

  it('podobny wpis ręczny trafia do podpowiedzi', () => {
    const [w] = zastosujPropozycje(
      wierszeZKolejki([dowod({ opis: 'JUDO', kwota_pelna: -75, data: '2026-09-14' })], { kategorie }),
      { zobowiazania: [], aliasy: [], bezDowodu: [{ id: 't-judo', data: '2026-09-15', typ: 'Wydatek', kwota: 75, kategoria: 'Dzieci' }] },
      kategorie
    );
    expect(w._dedup.reczne.map(r => r.id)).toEqual(['t-judo']);
  });
});

describe('ustawUdzial', () => {
  const [tx] = wierszeZKolejki([dowod({ opis: 'PWIK' , kwota_pelna: -265.47 })], { kategorie });

  it('liczy kwotę udziału z brutto i dopisuje ślad', () => {
    const w = ustawUdzial(tx, '1/2');
    expect(w.kwota).toBe(-132.74);
    expect(w.opis).toBe('PWIK [udział 1/2 z 265,47 zł]');
    expect(w._dedup).toMatchObject({ udzial: '1/2', kwotaPelna: 265.47 });
  });

  it('zmiana udziału podmienia ślad, pusty przywraca brutto', () => {
    const w = ustawUdzial(ustawUdzial(tx, '1/2'), '4/6');
    expect(w.opis).toBe('PWIK [udział 4/6 z 265,47 zł]');
    expect(w.kwota).toBe(-176.98);
    const c = ustawUdzial(w, '');
    expect([c.kwota, c.opis, c._dedup.udzial]).toEqual([-265.47, 'PWIK', null]);
  });
});

describe('pozycjeZatwierdzenia', () => {
  it('payload z udziałem, kwota_pelna i zobowiazanie_id', () => {
    const lista = zastosujPropozycje(
      wierszeZKolejki([dowod()], { kategorie }),
      { zobowiazania: [play], aliasy: [], bezDowodu: [] },
      kategorie
    );
    expect(pozycjeZatwierdzenia(lista)).toEqual([{
      dowod_id: 'd1',
      zobowiazanie_id: 'z-play',
      transakcja_id: null,
      transakcja: {
        data: '2026-10-04', typ: 'Wydatek', kwota: 59.99, kategoria: 'Rachunki', podkategoria: 'Telefon',
        osoba: 'Teresa', komentarz: 'PRZELEW F/60345080/09/26 [udział 1/2 z 119,98 zł]',
        kwota_pelna: 119.98, udzial: '1/2',
      },
    }]);
  });

  it('bez udziału kwota_pelna = null; „dołącz" wysyła transakcja_id', () => {
    const [a, b] = wierszeZKolejki([dowod({ id: 'a', opis: 'BIEDRONKA', kwota_pelna: -45.1 }), dowod({ id: 'b' })], { kategorie });
    const [pa, pb] = pozycjeZatwierdzenia([a, { ...b, _dedup: { ...b._dedup, akcja: 'dolacz', dolaczDo: 't-1' } }]);
    expect(pa.transakcja).toMatchObject({ kwota: 45.1, kwota_pelna: null, udzial: null });
    expect(pb).toEqual({ dowod_id: 'b', zobowiazanie_id: null, transakcja: null, transakcja_id: 't-1' });
  });
});

describe('filtry', () => {
  const lista = wierszeZKolejki([
    dowod({ id: 'a', data: '2026-09-30' }),
    dowod({ id: 'b', data: '2026-10-01', zrodlo: 'revolut' }),
  ], { kategorie });

  it('miesiąc i źródło', () => {
    expect(lista.filter(t => pasujeDoFiltrow(t, { miesiac: '2026-10' })).map(t => t.dowodId)).toEqual(['b']);
    expect(lista.filter(t => pasujeDoFiltrow(t, { zrodlo: 'millennium' })).map(t => t.dowodId)).toEqual(['a']);
    expect(miesiaceKolejki(lista)).toEqual(['2026-10', '2026-09']);
  });
});
