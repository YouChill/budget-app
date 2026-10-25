import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Przepływ dla dowolnego CSV (bez rozpoznanego banku): ręczne mapowanie,
// reguła rozpoznawania, usunięcie wiersza i zapis starą ścieżką (baza bez
// migracji 014 → addTransakcjeBatch).

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getUser: vi.fn() } } }));
vi.mock('../../services/categoryAI', () => ({
  isAIEnabled: vi.fn(() => false),
  categorizeWithAI: vi.fn(async (d) => d.map(() => null)),
  saveCategoryRule: vi.fn(),
  saveCategoryRulesBatch: vi.fn(),
}));
const api = vi.hoisted(() => ({
  sprawdzOdciski: vi.fn(),
  getKontekstParowania: vi.fn(),
  importujTransakcje: vi.fn(),
  addTransakcjeBatch: vi.fn(),
  getReguly: vi.fn(),
  addRegula: vi.fn(),
  deleteRegula: vi.fn(),
}));
vi.mock('../../services/api', () => api);

import CSVImport from '../CSVImport';

const csv = [
  'Data;Kwota;Opis;Saldo',
  '2026-10-01;-12,50;SKLEP XYZ 123;100',
  '2026-10-02;-30,00;PALIWO STACJA;70',
  '2026-10-03;-5,00;SKLEP XYZ 456;65',
].join('\n');

const kategorie = {
  Wydatek: { Jedzenie: ['Zakupy domowe'], Inne: ['Nieprzewidziane'] },
  Przychód: { Inne: ['Nieprzewidziane'] },
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.sprawdzOdciski.mockResolvedValue(null); // brak migracji 014
  api.addTransakcjeBatch.mockResolvedValue({ success: true, count: 2 });
  api.getReguly.mockResolvedValue([]);
  api.addRegula.mockImplementation(async (r) => ({ regula: { id: 'r1', ...r } }));
});

async function doPodgladu(onSaved = vi.fn()) {
  const { container } = render(<CSVImport onClose={() => {}} kategorie={kategorie} osoby={['Paweł']} onSaved={onSaved} />);
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File([csv], 'wyciag.csv', { type: 'text/csv' })] },
  });

  await screen.findByText('Dopasuj kolumny do pól');
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'Data' } });   // data
  fireEvent.change(selects[1], { target: { value: 'Kwota' } });  // kwota
  fireEvent.change(selects[3], { target: { value: 'Opis' } });   // opis
  fireEvent.change(screen.getByDisplayValue('— Wybierz osobę —'), { target: { value: 'Paweł' } });
  fireEvent.click(screen.getByText('Dalej →'));
  await screen.findByText('Podgląd importu');
}

describe('CSVImport — dowolny CSV', () => {
  it('ostrzega o braku sprawdzania duplikatów i pokazuje wiersze bez kategorii', async () => {
    await doPodgladu();
    expect(screen.getByRole('alert')).toHaveTextContent('Nie sprawdzono duplikatów');
    expect(screen.getByText('3 bez kategorii')).toBeInTheDocument();
    expect(screen.getByText('Importuj 3 transakcji')).toBeInTheDocument();
  });

  it('reguła przypisuje kategorię pasującym wierszom i zapisuje się na przyszłość', async () => {
    await doPodgladu();
    fireEvent.click(screen.getByText('+ Dodaj regułę'));
    fireEvent.change(screen.getByPlaceholderText('np. Biedronka, Allegro…'), { target: { value: 'xyz' } });
    const panel = screen.getByPlaceholderText('np. Biedronka, Allegro…').closest('.grid');
    const [, kategoria] = within(panel).getAllByRole('combobox');
    fireEvent.change(kategoria, { target: { value: 'Jedzenie' } });
    fireEvent.click(screen.getByText('Dodaj i zastosuj'));

    expect(await screen.findByText(/Przypisano/)).toHaveTextContent('Przypisano 2 transakcji → Jedzenie');
    expect(screen.getByText('1 bez kategorii')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('np. Biedronka, Allegro…')).not.toBeInTheDocument();
    expect(api.addRegula).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'xyz', kategoria: 'Jedzenie', typ: 'Wydatek' }));
    expect(localStorage.getItem('csv_recognition_rules')).toBeNull();
  });

  it('reguła bez kategorii nie przechodzi walidacji', async () => {
    await doPodgladu();
    fireEvent.click(screen.getByText('+ Dodaj regułę'));
    fireEvent.change(screen.getByPlaceholderText('np. Biedronka, Allegro…'), { target: { value: 'xyz' } });
    fireEvent.click(screen.getByText('Dodaj i zastosuj'));
    expect(screen.getByText('Wybierz kategorię')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('np. Biedronka, Allegro…')).toHaveValue('xyz');
  });

  it('usunięty wiersz nie trafia do importu; zapis starą ścieżką', async () => {
    const onSaved = vi.fn();
    await doPodgladu(onSaved);
    fireEvent.click(screen.getByRole('button', { name: 'Usuń wiersz 2 z importu' }));
    fireEvent.click(screen.getByText('Importuj 2 transakcji'));

    await screen.findByText('Import zakończony!');
    const [rekordy] = api.addTransakcjeBatch.mock.calls[0];
    expect(rekordy.map(r => [r.data, r.kwota, r.opis, r.osoba])).toEqual([
      ['2026-10-01', -12.5, 'SKLEP XYZ 123', 'Paweł'],
      ['2026-10-03', -5, 'SKLEP XYZ 456', 'Paweł'],
    ]);
    expect(api.importujTransakcje).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    await waitFor(() => expect(localStorage.getItem('csv_import_progress')).toBeNull());
  });
});
