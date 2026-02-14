import { describe, it, expect } from 'vitest';
import {
  MONTHS_PL_SHORT,
  aggregateByMonth,
  aggregateByCategory,
  aggregateByPerson,
  calculateYoY,
} from '../utils/calculations';

// ============================================
// TEST DATA
// ============================================
const sampleTransakcje = [
  { id: 1, data: '2025-01-15', typ: 'Przychód', kwota: 5000, kategoria: 'Wynagrodzenie', osoba: 'Anna' },
  { id: 2, data: '2025-01-20', typ: 'Wydatek', kwota: 200, kategoria: 'Jedzenie', osoba: 'Anna' },
  { id: 3, data: '2025-01-25', typ: 'Wydatek', kwota: 100, kategoria: 'Transport', osoba: 'Tomek' },
  { id: 4, data: '2025-02-10', typ: 'Przychód', kwota: 5000, kategoria: 'Wynagrodzenie', osoba: 'Anna' },
  { id: 5, data: '2025-02-15', typ: 'Wydatek', kwota: 300, kategoria: 'Jedzenie', osoba: 'Tomek' },
  { id: 6, data: '2025-03-05', typ: 'Przychód', kwota: 3000, kategoria: 'Freelance', osoba: 'Tomek' },
  { id: 7, data: '2025-03-20', typ: 'Wydatek', kwota: 1500, kategoria: 'Czynsz', osoba: 'Anna' },
  { id: 8, data: '2025-12-01', typ: 'Wydatek', kwota: 500, kategoria: 'Prezenty', osoba: 'Anna' },
];

describe('MONTHS_PL_SHORT', () => {
  it('zawiera 12 skróconych nazw miesięcy', () => {
    expect(MONTHS_PL_SHORT).toHaveLength(12);
  });

  it('zaczyna się od Sty i kończy na Gru', () => {
    expect(MONTHS_PL_SHORT[0]).toBe('Sty');
    expect(MONTHS_PL_SHORT[11]).toBe('Gru');
  });

  it('zawiera poprawne skróty', () => {
    expect(MONTHS_PL_SHORT[1]).toBe('Lut');
    expect(MONTHS_PL_SHORT[4]).toBe('Maj');
    expect(MONTHS_PL_SHORT[9]).toBe('Paź');
  });
});

describe('aggregateByMonth', () => {
  it('zwraca tablicę 12 miesięcy', () => {
    const result = aggregateByMonth(sampleTransakcje);
    expect(result).toHaveLength(12);
  });

  it('przypisuje przychody i wydatki do właściwych miesięcy', () => {
    const result = aggregateByMonth(sampleTransakcje);
    // Styczeń (index 0): przychody=5000, wydatki=200+100=300
    expect(result[0].przychody).toBe(5000);
    expect(result[0].wydatki).toBe(300);
    // Luty (index 1): przychody=5000, wydatki=300
    expect(result[1].przychody).toBe(5000);
    expect(result[1].wydatki).toBe(300);
    // Marzec (index 2): przychody=3000, wydatki=1500
    expect(result[2].przychody).toBe(3000);
    expect(result[2].wydatki).toBe(1500);
  });

  it('ustawia 0 dla miesięcy bez transakcji', () => {
    const result = aggregateByMonth(sampleTransakcje);
    // Kwiecień (index 3) — brak transakcji
    expect(result[3].przychody).toBe(0);
    expect(result[3].wydatki).toBe(0);
  });

  it('używa polskich skróconych nazw miesięcy', () => {
    const result = aggregateByMonth(sampleTransakcje);
    expect(result[0].month).toBe('Sty');
    expect(result[11].month).toBe('Gru');
  });

  it('obsługuje grudzień poprawnie', () => {
    const result = aggregateByMonth(sampleTransakcje);
    // Grudzień (index 11): wydatki=500
    expect(result[11].wydatki).toBe(500);
    expect(result[11].przychody).toBe(0);
  });

  it('obsługuje pustą tablicę', () => {
    const result = aggregateByMonth([]);
    expect(result).toHaveLength(12);
    result.forEach(m => {
      expect(m.przychody).toBe(0);
      expect(m.wydatki).toBe(0);
    });
  });

  it('obsługuje undefined', () => {
    const result = aggregateByMonth(undefined);
    expect(result).toHaveLength(12);
  });

  it('parsuje kwoty z string na number', () => {
    const data = [
      { data: '2025-01-10', typ: 'Wydatek', kwota: '150.50' },
    ];
    const result = aggregateByMonth(data);
    expect(result[0].wydatki).toBe(150.5);
  });
});

describe('aggregateByCategory', () => {
  it('grupuje wydatki wg kategorii domyślnie', () => {
    const result = aggregateByCategory(sampleTransakcje);
    const names = result.map(r => r.name);
    expect(names).toContain('Jedzenie');
    expect(names).toContain('Transport');
    expect(names).toContain('Czynsz');
    expect(names).toContain('Prezenty');
  });

  it('sumuje wydatki w tej samej kategorii', () => {
    const result = aggregateByCategory(sampleTransakcje);
    const jedzenie = result.find(r => r.name === 'Jedzenie');
    expect(jedzenie.value).toBe(500); // 200 + 300
  });

  it('sortuje malejąco wg wartości', () => {
    const result = aggregateByCategory(sampleTransakcje);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].value).toBeLessThanOrEqual(result[i - 1].value);
    }
  });

  it('filtruje przychody gdy typ="Przychód"', () => {
    const result = aggregateByCategory(sampleTransakcje, 'Przychód');
    const names = result.map(r => r.name);
    expect(names).toContain('Wynagrodzenie');
    expect(names).toContain('Freelance');
    expect(names).not.toContain('Jedzenie');
  });

  it('zwraca pustą tablicę gdy brak pasujących transakcji', () => {
    const result = aggregateByCategory([], 'Wydatek');
    expect(result).toEqual([]);
  });

  it('przypisuje "Inne" dla transakcji bez kategorii', () => {
    const data = [
      { data: '2025-01-01', typ: 'Wydatek', kwota: 50, kategoria: null },
    ];
    const result = aggregateByCategory(data);
    expect(result[0].name).toBe('Inne');
  });
});

describe('aggregateByPerson', () => {
  it('grupuje transakcje wg osoby', () => {
    const result = aggregateByPerson(sampleTransakcje);
    const names = result.map(r => r.name);
    expect(names).toContain('Anna');
    expect(names).toContain('Tomek');
  });

  it('oblicza przychody, wydatki i bilans per osoba', () => {
    const result = aggregateByPerson(sampleTransakcje);
    const anna = result.find(r => r.name === 'Anna');
    expect(anna.przychody).toBe(10000); // 5000 + 5000
    expect(anna.wydatki).toBe(2200);    // 200 + 1500 + 500
    expect(anna.bilans).toBe(7800);
  });

  it('sortuje malejąco wg wydatków', () => {
    const result = aggregateByPerson(sampleTransakcje);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].wydatki).toBeLessThanOrEqual(result[i - 1].wydatki);
    }
  });

  it('przypisuje "Nieprzypisane" dla transakcji bez osoby', () => {
    const data = [
      { data: '2025-01-01', typ: 'Wydatek', kwota: 50, osoba: null },
    ];
    const result = aggregateByPerson(data);
    expect(result[0].name).toBe('Nieprzypisane');
  });

  it('obsługuje pustą tablicę', () => {
    const result = aggregateByPerson([]);
    expect(result).toEqual([]);
  });
});

describe('calculateYoY', () => {
  it('oblicza procentową zmianę r/r', () => {
    const result = calculateYoY(1100, 1000);
    expect(result.change).toBe(100);
    expect(result.percent).toBeCloseTo(10);
  });

  it('obsługuje spadek wartości', () => {
    const result = calculateYoY(800, 1000);
    expect(result.change).toBe(-200);
    expect(result.percent).toBeCloseTo(-20);
  });

  it('zwraca null percent gdy previousValue = 0', () => {
    const result = calculateYoY(500, 0);
    expect(result.change).toBe(500);
    expect(result.percent).toBeNull();
  });

  it('obsługuje obie wartości = 0', () => {
    const result = calculateYoY(0, 0);
    expect(result.change).toBe(0);
    expect(result.percent).toBeNull();
  });

  it('oblicza poprawnie przy dużych zmianach', () => {
    const result = calculateYoY(3000, 1000);
    expect(result.change).toBe(2000);
    expect(result.percent).toBeCloseTo(200);
  });

  it('obsługuje ujemne wartości', () => {
    const result = calculateYoY(-100, -200);
    expect(result.change).toBe(100);
    // change=100, abs(prev)=200 → 100/200*100 = 50%
    expect(result.percent).toBeCloseTo(50);
  });
});
