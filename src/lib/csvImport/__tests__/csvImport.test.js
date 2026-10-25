import { describe, it, expect } from 'vitest';
import { wczytajWiersze } from '../banki';
import { zastosujRegule } from '../kategoryzacja';
import { przygotujTransakcje, edytujPole, liczStatusy, bezKategorii } from '../przygotowanie';

const kategorie = {
  Wydatek: { Jedzenie: ['Zakupy domowe'], Inne: ['Nieprzewidziane'] },
  Przychód: { Wynagrodzenie: ['Pensja'], Inne: ['Nieprzewidziane'] },
};

describe('wczytajWiersze', () => {
  it('za mało wierszy → null', () => {
    expect(wczytajWiersze({ data: [['a', 'b']] })).toBeNull();
    expect(wczytajWiersze({ data: [] })).toBeNull();
  });

  it('Millennium: mapowanie Obciążenia/Uznania i dane odcisku', () => {
    const naglowek = ['Numer rachunku/karty', 'Data transakcji', 'Data rozliczenia', 'Rodzaj transakcji', 'Na konto/Z konta', 'Odbiorca/Zleceniodawca', 'Opis', 'Obciążenia', 'Uznania', 'Saldo', 'Waluta'];
    const wiersz = ['11 2222 3333 4444 5555 6666 7777', '2026-10-01', '2026-10-02', 'ZAKUP', '', '', 'ŻABKA Z1 WARSZAWA POL 2026-10-01', '-12,50', '', '1000,00', 'PLN'];
    const w = wczytajWiersze({ data: [naglowek, wiersz] });
    expect(w.detectedFormat).toBe('millennium');
    expect(w.columnMapping).toEqual({ data: 'Data transakcji', kwota: 'Obciążenia', uznania: 'Uznania', opis: 'Opis (wyodrębniony)' });
    expect(w.csvData[0]['Obciążenia']).toBe('-12,50');
    expect(w.csvData[0].__zrodlo.zrodlo).toBe('millennium');
  });

  it('Revolut: pomija operacje w toku i anulowane', () => {
    const h = ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Currency', 'State', 'Balance'];
    const ok = ['CARD_PAYMENT', 'Current', '2026-10-01 10:00:00', '2026-10-01 11:00:00', 'Lidl', '-20.00', '0', 'PLN', 'COMPLETED', '100'];
    const pending = ['CARD_PAYMENT', 'Current', '2026-10-02 10:00:00', '', 'Shell', '-50.00', '0', 'PLN', 'PENDING', ''];
    const w = wczytajWiersze({ data: [h, ok, pending] });
    expect(w.detectedFormat).toBe('revolut');
    expect(w.csvData).toHaveLength(1);
    expect(w.csvData[0]).toMatchObject({ Data: '2026-10-01', Kwota: '-20.00', Opis: 'Lidl' });
  });

  it('dowolny CSV z nagłówkami: bez mapowania (ręczne)', () => {
    const w = wczytajWiersze({ data: [['Data', 'Kwota', 'Opis'], ['2026-01-05', '-10', 'Kawa']] });
    expect(w.detectedFormat).toBeNull();
    expect(w.columnMapping).toBeNull();
    expect(w.headers).toEqual(['Data', 'Kwota', 'Opis']);
    expect(w.csvData).toEqual([{ Data: '2026-01-05', Kwota: '-10', Opis: 'Kawa' }]);
  });

  it('CSV bez nagłówków: kolumny generowane, pierwszy wiersz to dane', () => {
    const w = wczytajWiersze({ data: [['2026-01-05', '-10'], ['2026-01-06', '20']] });
    expect(w.headers).toEqual(['Kolumna 1', 'Kolumna 2']);
    expect(w.csvData).toHaveLength(2);
  });
});

describe('przygotujTransakcje', () => {
  const mapowanie = { data: 'Data', kwota: 'Obciążenia', uznania: 'Uznania', opis: 'Opis' };
  const headers = ['Data', 'Obciążenia', 'Uznania', 'Opis', 'Saldo'];

  it('obciążenia = wydatek ujemny, uznania = przychód, niezależnie od znaku w pliku', () => {
    const csvData = [
      { Data: '2026-01-05', Obciążenia: '12,50', Uznania: '', Opis: 'Biedronka', Saldo: '100' },
      { Data: '05.01.2026', Obciążenia: '', Uznania: '-5000,00', Opis: 'Pensja', Saldo: '5100' },
    ];
    const { transakcje, pominiete } = przygotujTransakcje({ csvData, headers, columnMapping: mapowanie, kategorie });
    expect(pominiete).toBe(0);
    expect(transakcje.map(t => [t.data, t.kwota, t.typ])).toEqual([
      ['2026-01-05', -12.5, 'Wydatek'],
      ['2026-01-05', 5000, 'Przychód'],
    ]);
    expect(transakcje[0]._zrodlo.zrodlo).toBe('csv'); // dowolny CSV dostaje odcisk z kolumn
  });

  it('pomija wiersze z błędną datą, meta pozostaje wyrównana do transakcji', () => {
    const csvData = [
      { Data: '31.02.2026', Obciążenia: '1', Uznania: '', Opis: 'zła data', Saldo: '' },
      { Data: '2026-01-07', Obciążenia: '2', Uznania: '', Opis: 'dobra', Saldo: '9' },
    ];
    const { transakcje, meta, pominiete } = przygotujTransakcje({ csvData, headers, columnMapping: mapowanie, kategorie });
    expect(pominiete).toBe(1);
    expect(transakcje).toHaveLength(1);
    expect(meta[0]._originalOpis).toBe('dobra');
    expect(meta[0]._csvRaw).toEqual({ Uznania: '', Saldo: '9' });
  });

  it('reguła użytkownika wygrywa nad brakiem dopasowania', () => {
    const csvData = [{ Data: '2026-01-05', Obciążenia: '3', Uznania: '', Opis: 'SKLEP XYZ', Saldo: '' }];
    const rules = [{ keyword: 'xyz', kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe', typ: 'Wydatek' }];
    const { transakcje } = przygotujTransakcje({ csvData, headers, columnMapping: mapowanie, rules, kategorie });
    expect(transakcje[0]).toMatchObject({ kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' });
  });
});

describe('edycja podglądu', () => {
  it('zmiana kwoty przestawia typ zgodnie ze znakiem; zero zostawia typ', () => {
    const tx = { kwota: -5, typ: 'Wydatek' };
    expect(edytujPole(tx, 'kwota', '7').typ).toBe('Przychód');
    expect(edytujPole(tx, 'kwota', -3).typ).toBe('Wydatek');
    expect(edytujPole(tx, 'kwota', '0').typ).toBe('Wydatek');
    expect(edytujPole(tx, 'opis', 'x')).toEqual({ kwota: -5, typ: 'Wydatek', opis: 'x' });
  });

  it('zastosujRegule zmienia tylko nieprzypisane wiersze zgodnego typu', () => {
    const lista = [
      { opis: 'Lidl Warszawa', typ: 'Wydatek', kategoria: 'Inne', podkategoria: 'Nieprzewidziane' },
      { opis: 'Lidl zwrot', typ: 'Przychód', kategoria: 'Inne', podkategoria: 'Nieprzewidziane' },
      { opis: 'Lidl', typ: 'Wydatek', kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
    ];
    const { updated, matchCount } = zastosujRegule({ keyword: 'LIDL', kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe', typ: 'Wydatek' }, lista);
    expect(matchCount).toBe(1);
    expect(updated[0].kategoria).toBe('Jedzenie');
    expect(updated[1].kategoria).toBe('Inne');
    expect(updated.filter(bezKategorii)).toHaveLength(1);
  });

  it('liczStatusy zlicza grupy rozpoznawania', () => {
    const lista = [{}, { _dedup: { status: 'zaksiegowana' } }, { _dedup: { status: 'nowa' } }];
    expect(liczStatusy(lista)).toEqual({ nowa: 2, zaksiegowana: 1, wszystkie: 3 });
  });
});
