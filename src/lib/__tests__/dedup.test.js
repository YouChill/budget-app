import { describe, it, expect } from 'vitest';
import {
  naGrosze,
  kluczMillennium,
  kluczGmail,
  rozroznijPowtorzenia,
  sha256Hex,
  udzialWGroszach,
  znacznikUdzialu,
  odczytajUdzial,
  kanonicznyRachunek,
} from '../odciski';
import { parujPartie, rozpoznajKontrahenta, oknoZobowiazania } from '../parowanie';
import { pozycjaZRekordu } from '../importPozycje';

// Dane testowe są zmyślone — numery kont to ciągi cyfr bez znaczenia.
const KONTO = '11 2222 3333 4444 5555 6666 7777';
const KONTO_PLAY = '99 8888 7777 6666 5555 4444 3333';

const millennium = (over = {}) => ({
  nrRachunku: KONTO,
  dataTransakcji: '2026-10-01',
  obciazenia: '-12,50',
  uznania: '',
  saldo: '1 000,00',
  opis: 'ŻABKA Z1234  WARSZAWA POL 2026-10-01',
  ...over,
});

describe('odciski', () => {
  it('naGrosze liczy na tekście, z ROUND_HALF_UP', () => {
    expect(naGrosze('-1 234,56')).toBe(-123456);
    expect(naGrosze('1.234,56')).toBe(123456);
    expect(naGrosze('-12.50')).toBe(-1250);
    expect(naGrosze('0,005')).toBe(1);
    expect(naGrosze('')).toBeNull();
    expect(naGrosze('abc')).toBeNull();
  });

  it('formatowanie konta i opisu nie zmienia odcisku Millennium', () => {
    const a = kluczMillennium(millennium());
    const b = kluczMillennium(millennium({ nrRachunku: KONTO.replace(/ /g, ''), opis: 'żabka z1234 warszawa pol 2026-10-01', saldo: '1000,00' }));
    expect(a).toBe(b);
  });

  it('dwa identyczne zakupy tego samego dnia różnią się saldem', () => {
    const a = kluczMillennium(millennium({ saldo: '1 000,00' }));
    const b = kluczMillennium(millennium({ saldo: '987,50' }));
    expect(a).not.toBe(b);
  });

  it('kwota z kolumny uznań, gdy obciążenia puste', () => {
    expect(kluczMillennium(millennium({ obciazenia: '', uznania: '50,00' }))).toContain('|50.00|');
  });

  it('Gmail: kontrahent + dokument, niezależnie od zapisu', () => {
    expect(kluczGmail({ kontrahent: 'Play', dokument: 'f/60345080/09/26' }))
      .toBe(kluczGmail({ kontrahent: 'play', dokument: 'F/60345080/09/26 ' }));
  });

  it('powtórzenia w pliku bez salda dostają sufiks, pierwszy wiersz bez zmian', () => {
    expect(rozroznijPowtorzenia(['a', 'b', 'a', 'a'])).toEqual(['a', 'b', 'a#2', 'a#3']);
  });

  it('sha256Hex zwraca 64 znaki hex i jest deterministyczny', async () => {
    const h = await sha256Hex('abc');
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('udział: ROUND_HALF_UP na groszach', () => {
    expect(udzialWGroszach(26547, '1/2')).toBe(13274); // 132,735 → 132,74
    expect(udzialWGroszach(10000, '4/6')).toBe(6667);
    expect(udzialWGroszach(11998, '1/2')).toBe(5999);
    expect(udzialWGroszach(500, null)).toBe(500);
  });

  it('znacznik udziału zapisuje i odczytuje pełną kwotę', () => {
    const z = znacznikUdzialu('4/6', 120000);
    expect(z).toBe('[udział 4/6 z 1 200,00 zł]');
    expect(odczytajUdzial(`Śmieci ${z}`)).toEqual({ udzial: '4/6', kwotaPelna: 1200 });
  });
});

// ─── Parowanie ────────────────────────────────────────────────────────────────

const PLAY = {
  id: 'z-play',
  kontrahent: 'play',
  dokument: 'F/60345080/09/26',
  kwota_pelna: 119.98,
  data_wystawienia: '2026-09-20',
  termin: '2026-10-05',
  sposob: 'przelew',
  kategoria: 'Rachunki',
  podkategoria: 'Telefon',
  udzial: '1/2',
  status: 'otwarte',
};
const APPLE = {
  id: 'z-apple',
  kontrahent: 'apple',
  dokument: 'MSM9L4X7V8',
  kwota_pelna: 49.99,
  termin: '2026-10-13',
  sposob: 'auto_karta',
  kategoria: 'Rozrywka',
  podkategoria: 'Subskrypcje',
  status: 'otwarte',
};
const ALIASY = [
  { wzorzec: KONTO_PLAY, typ_wzorca: 'rachunek', kontrahent: 'play' },
  { wzorzec: 'APPLE.COM/BILL', typ_wzorca: 'opis', kontrahent: 'apple' },
];

const wiersz = (over) => ({ zrodloId: 'x', typ: 'Wydatek', opis: '', tytul: '', rachunek: '', ...over });

describe('parowanie', () => {
  it('odcisk w bazie → już zaksięgowane', () => {
    const [r] = parujPartie([wiersz({ zrodloId: 'h1', data: '2026-10-01', kwotaGr: 1250 })], { istniejace: new Set(['h1']) });
    expect(r.status).toBe('zaksiegowana');
  });

  it('numer faktury w tytule przelewu łączy z zobowiązaniem Play', () => {
    const [r] = parujPartie(
      [wiersz({ data: '2026-10-04', kwotaGr: 11998, tytul: 'F/60345080/09/26', opis: 'PLAY' })],
      { zobowiazania: [PLAY, APPLE], aliasy: ALIASY }
    );
    expect(r.status).toBe('polaczona');
    expect(r.powod).toBe('dokument');
    expect(r.zobowiazanie.id).toBe('z-play');
  });

  it('dokument rozpoznany mimo spacji w tytule', () => {
    const [r] = parujPartie(
      [wiersz({ data: '2026-10-04', kwotaGr: 11998, tytul: 'faktura F/ 60345080/09/26' })],
      { zobowiazania: [PLAY] }
    );
    expect(r.status).toBe('polaczona');
  });

  it('kontrahent po numerze rachunku + kwota + okno → połączenie', () => {
    const [r] = parujPartie(
      [wiersz({ data: '2026-10-10', kwotaGr: 11998, rachunek: `PL${KONTO_PLAY}`, tytul: 'abonament' })],
      { zobowiazania: [PLAY], aliasy: ALIASY }
    );
    expect(r).toMatchObject({ status: 'polaczona', powod: 'kontrahent', kontrahent: 'play' });
  });

  it('Apple 49,99 zł 15.10 przy odnowieniu 13.10 → łączy się', () => {
    const [r] = parujPartie(
      [wiersz({ data: '2026-10-15', kwotaGr: 4999, opis: 'APPLE.COM/BILL CORK IRL' })],
      { zobowiazania: [APPLE], aliasy: ALIASY }
    );
    expect(r.status).toBe('polaczona');
    expect(r.zobowiazanie.id).toBe('z-apple');
  });

  it('Apple 49,99 zł 25.10 → poza oknem, bez połączenia', () => {
    const [r] = parujPartie(
      [wiersz({ data: '2026-10-25', kwotaGr: 4999, opis: 'APPLE.COM/BILL CORK IRL' })],
      { zobowiazania: [APPLE], aliasy: ALIASY }
    );
    expect(r.status).not.toBe('polaczona');
  });

  it('okno auto_karta: [odnowienie − 1, odnowienie + 4]', () => {
    const [od, doDnia] = oknoZobowiazania(APPLE);
    expect(doDnia - od).toBe(5);
  });

  it('dwóch kandydatów tej samej kwoty → do weryfikacji, nic nie połączone', () => {
    const drugi = { ...APPLE, id: 'z-apple-2', dokument: 'MXX0000001' };
    const [r] = parujPartie(
      [wiersz({ data: '2026-10-14', kwotaGr: 4999, opis: 'APPLE.COM/BILL' })],
      { zobowiazania: [APPLE, drugi], aliasy: ALIASY }
    );
    expect(r.status).toBe('do_weryfikacji');
    expect(r.kandydaci).toHaveLength(2);
    expect(r.zobowiazanie).toBeUndefined();
  });

  it('brak kontrahenta przy zgodnej kwocie → tylko podpowiedź', () => {
    const [r] = parujPartie(
      [wiersz({ data: '2026-10-14', kwotaGr: 4999, opis: 'SKLEP XYZ' })],
      { zobowiazania: [APPLE], aliasy: ALIASY }
    );
    expect(r.status).toBe('do_weryfikacji');
    expect(r.powod).toBe('brak_kontrahenta');
  });

  it('dwa wiersze partii wskazujące to samo zobowiązanie → oba do weryfikacji', () => {
    const wyniki = parujPartie(
      [
        wiersz({ zrodloId: 'a', data: '2026-10-14', kwotaGr: 4999, opis: 'APPLE.COM/BILL' }),
        wiersz({ zrodloId: 'b', data: '2026-10-15', kwotaGr: 4999, opis: 'APPLE.COM/BILL' }),
      ],
      { zobowiazania: [APPLE], aliasy: ALIASY }
    );
    expect(wyniki.map(r => r.status)).toEqual(['do_weryfikacji', 'do_weryfikacji']);
  });

  it('zobowiązanie z transakcją nie bierze udziału w parowaniu', () => {
    const [r] = parujPartie(
      [wiersz({ data: '2026-10-04', kwotaGr: 11998, tytul: 'F/60345080/09/26' })],
      { zobowiazania: [{ ...PLAY, status: 'oplacone', transakcja_id: 't-1' }] }
    );
    expect(r.status).toBe('nowa');
  });

  it('opłacone mailem, ale bez transakcji — nadal łączy się z wierszem banku', () => {
    const [r] = parujPartie(
      [wiersz({ data: '2026-10-04', kwotaGr: 11998, tytul: 'F/60345080/09/26' })],
      { zobowiazania: [{ ...PLAY, status: 'oplacone', transakcja_id: null }] }
    );
    expect(r.status).toBe('polaczona');
  });

  it('przychód nigdy nie łączy się z fakturą', () => {
    const [r] = parujPartie(
      [wiersz({ typ: 'Przychód', data: '2026-10-04', kwotaGr: 11998, tytul: 'F/60345080/09/26' })],
      { zobowiazania: [PLAY] }
    );
    expect(r.status).toBe('nowa');
  });

  it('wpis ręczny „Judo 75 zł" → ostrzeżenie, bez automatycznego łączenia', () => {
    const judo = { id: 't-judo', data: '2026-09-14', typ: 'Wydatek', kwota: 75, komentarz: 'Judo' };
    const [r] = parujPartie(
      [wiersz({ data: '2026-09-15', kwotaGr: 7500, opis: 'KLUB SPORTOWY' })],
      { bezDowodu: [judo] }
    );
    expect(r.status).toBe('nowa');
    expect(r.reczne.map(t => t.id)).toEqual(['t-judo']);
  });

  it('wpis ręczny po podziale (1/2) też jest wykrywany', () => {
    const woda = { id: 't-woda', data: '2026-09-10', typ: 'Wydatek', kwota: 132.74, komentarz: 'woda' };
    const [r] = parujPartie([wiersz({ data: '2026-09-11', kwotaGr: 26547 })], { bezDowodu: [woda] });
    expect(r.reczne).toHaveLength(1);
  });

  it('wpis ręczny 3 dni dalej albo innego typu — bez ostrzeżenia', () => {
    const bezDowodu = [
      { id: 'a', data: '2026-09-18', typ: 'Wydatek', kwota: 75 },
      { id: 'b', data: '2026-09-15', typ: 'Przychód', kwota: 75 },
    ];
    const [r] = parujPartie([wiersz({ data: '2026-09-15', kwotaGr: 7500 })], { bezDowodu });
    expect(r.reczne).toEqual([]);
  });

  it('krótki wzorzec rachunku nie dopasowuje się do końcówki każdego konta', () => {
    expect(rozpoznajKontrahenta({ rachunek: KONTO }, [{ wzorzec: '7777', typ_wzorca: 'rachunek', kontrahent: 'x' }])).toBeNull();
  });

  it('wiersz z kolejki (tylko rachunekHmac) dopasowuje alias po HMAC', () => {
    const aliasy = [
      { wzorzec: KONTO_PLAY, wzorzecHmac: 'a'.repeat(64), typ_wzorca: 'rachunek', kontrahent: 'play' },
      { wzorzec: 'APPLE.COM/BILL', typ_wzorca: 'opis', kontrahent: 'apple' },
    ];
    expect(rozpoznajKontrahenta({ rachunekHmac: 'a'.repeat(64), opis: 'PRZELEW' }, aliasy)).toBe('play');
    expect(rozpoznajKontrahenta({ rachunekHmac: 'b'.repeat(64), opis: 'PRZELEW' }, aliasy)).toBeNull();
    // alias bez HMAC (krótszy niż 26 cyfr) nie łapie wiersza bez pełnego rachunku
    expect(rozpoznajKontrahenta({ rachunekHmac: 'a'.repeat(64) }, [{ wzorzec: '7777', typ_wzorca: 'rachunek', kontrahent: 'x' }])).toBeNull();
    // opis działa dalej
    expect(rozpoznajKontrahenta({ rachunekHmac: 'b'.repeat(64), opis: 'APPLE.COM/BILL 123' }, aliasy)).toBe('apple');
  });
});

describe('kanonicznyRachunek', () => {
  const NRB = '61109010140000071219812874';
  it('z prefiksem PL i spacjami → 26 cyfr', () => {
    expect(kanonicznyRachunek(`PL${NRB}`)).toBe(NRB);
    expect(kanonicznyRachunek('PL 61 1090 1014 0000 0712 1981 2874')).toBe(NRB);
    expect(kanonicznyRachunek(NRB)).toBe(NRB);
  });
  it('dłuższy ciąg cyfr → ostatnie 26', () => {
    expect(kanonicznyRachunek(`0048${NRB}`)).toBe(NRB);
  });
  it('za krótki albo pusty → null', () => {
    expect(kanonicznyRachunek('1234 5678')).toBeNull();
    expect(kanonicznyRachunek('')).toBeNull();
    expect(kanonicznyRachunek(null)).toBeNull();
  });
});

describe('pozycjaZRekordu', () => {
  it('rozdziela rekord na dowód (brutto ze znakiem) i transakcję (udział)', () => {
    const p = pozycjaZRekordu({
      data: '2026-10-04', typ: 'Wydatek', kwota: -59.99, kategoria: 'Rachunki', podkategoria: 'Telefon',
      osoba: 'Paweł', komentarz: 'Play', zrodlo: 'millennium', zrodlo_id: 'h3',
      kwota_pelna: 119.98, udzial: '1/2', zobowiazanie_id: 'z-play',
    });
    expect(p.dowod).toMatchObject({ zrodlo: 'millennium', zrodlo_id: 'h3', kwota_pelna: -119.98 });
    expect(p.transakcja).toMatchObject({ kwota: 59.99, kwota_pelna: 119.98, udzial: '1/2', osoba: 'Paweł' });
    expect(p.zobowiazanie_id).toBe('z-play');
  });

  it('bez zrodlo_id — sam wpis, bez dowodu', () => {
    expect(pozycjaZRekordu({ data: '2026-10-01', typ: 'Wydatek', kwota: 75, kategoria: 'Dzieci', osoba: 'P' }).dowod).toBeNull();
  });

  it('z transakcja_id — tylko dowód, bez nowej transakcji', () => {
    const p = pozycjaZRekordu({ data: '2026-10-01', typ: 'Wydatek', kwota: 75, zrodlo_id: 'h', transakcja_id: 't1' });
    expect(p.transakcja).toBeNull();
    expect(p.transakcja_id).toBe('t1');
  });
});
