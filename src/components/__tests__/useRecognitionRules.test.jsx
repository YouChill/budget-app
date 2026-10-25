import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, waitFor, act } from '@testing-library/react';

// Reguły rozpoznawania w bazie (#133): hook na API i jednorazowe
// przeniesienie reguł z localStorage.

const api = vi.hoisted(() => ({
  getReguly: vi.fn(),
  addRegula: vi.fn(),
  deleteRegula: vi.fn(),
}));
vi.mock('../../services/api', () => api);

import { useRecognitionRules, czytajLokalneReguly, RULES_STORAGE_KEY } from '../kolejka/useRecognitionRules';
import LocalRulesMigrationDialog from '../kolejka/LocalRulesMigrationDialog';

const R1 = { id: 'r1', keyword: 'Biedronka', typ: 'Wydatek', kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.getReguly.mockResolvedValue([R1]);
  let n = 1;
  api.addRegula.mockImplementation(async (r) => ({ regula: { id: `r${++n}`, ...r } }));
  api.deleteRegula.mockResolvedValue({ success: true });
});

describe('useRecognitionRules', () => {
  it('ładuje reguły z API', async () => {
    const { result } = renderHook(() => useRecognitionRules());
    await waitFor(() => expect(result.current.rules).toEqual([R1]));
    expect(result.current.dostepne).toBe(true);
    expect(result.current.lokalne).toBeNull();
  });

  it('dodanie i usunięcie odświeża listę, bez zapisu do localStorage', async () => {
    const { result } = renderHook(() => useRecognitionRules());
    await waitFor(() => expect(result.current.rules).toHaveLength(1));

    await act(() => result.current.addRule({ keyword: 'orlen', typ: 'Wydatek', kategoria: 'Transport', podkategoria: 'Paliwo' }));
    expect(result.current.rules.map(r => r.keyword)).toEqual(['Biedronka', 'orlen']);

    await act(() => result.current.deleteRule('r1'));
    expect(api.deleteRegula).toHaveBeenCalledWith('r1');
    expect(result.current.rules.map(r => r.keyword)).toEqual(['orlen']);
    expect(localStorage.getItem(RULES_STORAGE_KEY)).toBeNull();
  });

  it('duplikat nie zmienia listy', async () => {
    api.addRegula.mockResolvedValueOnce({ duplikat: true });
    const { result } = renderHook(() => useRecognitionRules());
    await waitFor(() => expect(result.current.rules).toHaveLength(1));
    let wynik;
    await act(async () => { wynik = await result.current.addRule({ keyword: 'biedronka', typ: 'Wydatek', kategoria: 'Jedzenie' }); });
    expect(wynik).toEqual({ duplikat: true });
    expect(result.current.rules).toHaveLength(1);
  });

  it('baza bez migracji: pusta lista, dostepne = false, bez propozycji przeniesienia', async () => {
    api.getReguly.mockResolvedValue(null);
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify([{ keyword: 'orlen', kategoria: 'Transport' }]));
    const { result } = renderHook(() => useRecognitionRules());
    await waitFor(() => expect(result.current.dostepne).toBe(false));
    expect(result.current.rules).toEqual([]);
    expect(result.current.lokalne).toBeNull();
  });
});

describe('przeniesienie reguł z localStorage', () => {
  const LOKALNE = [
    { keyword: 'Orlen ', kategoria: 'Transport', podkategoria: 'Paliwo', typ: 'Wydatek', createdAt: 1 },
    { keyword: 'bp', kategoria: 'Transport', podkategoria: 'Paliwo', typ: 'Wydatek', createdAt: 2 },
    { keyword: 'Biedronka', kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe', typ: 'Wydatek', createdAt: 3 },
  ];

  it('dzieli reguły na do przeniesienia i za krótkie', () => {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(LOKALNE));
    const { doPrzeniesienia, krotkie } = czytajLokalneReguly();
    expect(doPrzeniesienia.map(r => r.keyword)).toEqual(['Orlen ', 'Biedronka']);
    expect(krotkie.map(r => r.keyword)).toEqual(['bp']);
  });

  it('„Przenieś" zapisuje reguły w bazie (duplikaty ignorowane) i usuwa klucz', async () => {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(LOKALNE));
    api.addRegula.mockImplementation(async (r) => (r.keyword === 'Biedronka' ? { duplikat: true } : { regula: { id: 'r9', ...r } }));
    const { result } = renderHook(() => useRecognitionRules());
    await waitFor(() => expect(result.current.lokalne).not.toBeNull());

    let przeniesione;
    await act(async () => { przeniesione = await result.current.przeniesLokalne(); });
    expect(api.addRegula.mock.calls.map(([r]) => r.keyword)).toEqual(['Orlen', 'Biedronka']);
    expect(przeniesione).toBe(1);
    expect(localStorage.getItem(RULES_STORAGE_KEY)).toBeNull();
    expect(result.current.lokalne).toBeNull();
    expect(api.getReguly).toHaveBeenCalledTimes(2);
  });

  it('błąd zapisu zostawia reguły na urządzeniu', async () => {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(LOKALNE));
    api.addRegula.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useRecognitionRules());
    await waitFor(() => expect(result.current.lokalne).not.toBeNull());
    await act(async () => { await expect(result.current.przeniesLokalne()).rejects.toThrow('offline'); });
    expect(localStorage.getItem(RULES_STORAGE_KEY)).not.toBeNull();
  });

  it('dialog: pokazuje pominięte, „Nie" usuwa dopiero po drugim potwierdzeniu', () => {
    const onOdrzuc = vi.fn();
    const onPrzenies = vi.fn();
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(LOKALNE));
    render(<LocalRulesMigrationDialog lokalne={czytajLokalneReguly()} onPrzenies={onPrzenies} onOdrzuc={onOdrzuc} onPozniej={vi.fn()} />);

    expect(screen.getByText(/Przenieść 2 reguły z tego urządzenia/)).toHaveTextContent('Pominięte (krótsze niż 3 znaki): „bp”');
    fireEvent.click(screen.getByText('Nie'));
    expect(onOdrzuc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Wróć'));
    fireEvent.click(screen.getByText('Nie'));
    fireEvent.click(screen.getByText('Nie, usuń'));
    expect(onOdrzuc).toHaveBeenCalledTimes(1);
    expect(onPrzenies).not.toHaveBeenCalled();
  });
});
