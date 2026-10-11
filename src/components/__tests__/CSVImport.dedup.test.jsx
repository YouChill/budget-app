/**
 * Przepływ „już zaksięgowane" w komponencie: wyciąg Millennium wgrany drugi
 * raz — wiersz z odciskiem w bazie jest odznaczony i nie trafia do importu.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { sha256Hex } from '../../lib/odciski';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getUser: vi.fn() } } }));
vi.mock('../../services/categoryAI', () => ({
  isAIEnabled: vi.fn(() => false),
  categorizeWithAI: vi.fn(async (d) => d.map(() => null)),
  saveCategoryRulesBatch: vi.fn(),
}));

const api = vi.hoisted(() => ({
  sprawdzOdciski: vi.fn(),
  getKontekstParowania: vi.fn(),
  importujTransakcje: vi.fn(),
  addTransakcjeBatch: vi.fn(),
}));
vi.mock('../../services/api', () => api);

import CSVImport, { zrodloMillennium } from '../CSVImport';

const NAGLOWEK = '"Numer rachunku/karty","Data transakcji","Data rozliczenia","Rodzaj transakcji","Na konto/Z konta","Odbiorca/Zleceniodawca","Opis","Obciążenia","Uznania","Saldo","Waluta"';
const W1 = ['11 2222 3333 4444 5555 6666 7777', '2026-10-01', '2026-10-02', 'ZAKUP - FIZ. UŻYCIE KARTY', '', '', 'ŻABKA Z1  WARSZAWA POL 2026-10-01', '-12,50', '', '1000,00', 'PLN'];
const W2 = [...W1.slice(0, 9), '987,50', 'PLN'];
const csv = [NAGLOWEK, ...[W1, W2].map(r => r.map(c => `"${c}"`).join(','))].join('\n');

const kategorie = { Wydatek: { Jedzenie: ['Zakupy domowe'], Inne: ['Nieprzewidziane'] }, Przychód: {} };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

async function doPodgladu() {
  const odcisk1 = await sha256Hex(zrodloMillennium(W1).klucz);
  api.sprawdzOdciski.mockResolvedValue(new Map([[odcisk1, 't-istniejaca']]));
  api.getKontekstParowania.mockResolvedValue({ zobowiazania: [], aliasy: [], bezDowodu: [] });
  api.importujTransakcje.mockResolvedValue({ success: true, dodane: 1, pominiete: 0, polaczone: 0, dolaczone: 0 });

  const { container } = render(<CSVImport onClose={() => {}} kategorie={kategorie} osoby={['Paweł']} />);
  const input = container.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [new File([csv], 'wyciag.csv', { type: 'text/csv' })] } });

  await screen.findByText('Wykryto format Bank Millennium');
  const osoba = screen.getByDisplayValue('— Wybierz osobę —');
  fireEvent.change(osoba, { target: { value: 'Paweł' } });
  fireEvent.click(screen.getByText('Dalej →'));
  await screen.findByRole('tab', { name: /Już zaksięgowane/ });
}

describe('CSVImport — już zaksięgowane', () => {
  it('pokazuje grupy i odznacza wiersz z odciskiem w bazie', async () => {
    await doPodgladu();
    expect(screen.getByRole('tab', { name: /Już zaksięgowane \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Nowe \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText('Importuj 1 transakcji')).toBeInTheDocument();

    const boxes = screen.getAllByRole('checkbox', { name: /Importuj wiersz/ });
    expect(boxes[0]).not.toBeChecked();
    expect(boxes[0]).toBeDisabled(); // transakcja istnieje — nie ma czego odtwarzać
    expect(boxes[1]).toBeChecked();
  });

  it('import wysyła tylko nowy wiersz, z odciskiem i bez pełnego numeru konta', async () => {
    await doPodgladu();
    fireEvent.click(screen.getByText('Importuj 1 transakcji'));
    await waitFor(() => expect(api.importujTransakcje).toHaveBeenCalled());

    const [rekordy] = api.importujTransakcje.mock.calls[0];
    expect(rekordy).toHaveLength(1);
    expect(rekordy[0]).toMatchObject({ zrodlo: 'millennium', osoba: 'Paweł', kwota: -12.5 });
    expect(rekordy[0].zrodlo_id).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rekordy)).not.toContain('22223333');
    await screen.findByText('Import zakończony!');
  });

  it('bez migracji 014 ostrzega i importuje starą ścieżką', async () => {
    api.sprawdzOdciski.mockResolvedValue(null);
    api.addTransakcjeBatch.mockResolvedValue({ success: true, count: 2 });
    const { container } = render(<CSVImport onClose={() => {}} kategorie={kategorie} osoby={['Paweł']} />);
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File([csv], 'wyciag.csv', { type: 'text/csv' })] },
    });
    await screen.findByText('Wykryto format Bank Millennium');
    fireEvent.change(screen.getByDisplayValue('— Wybierz osobę —'), { target: { value: 'Paweł' } });
    fireEvent.click(screen.getByText('Dalej →'));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Nie sprawdzono duplikatów/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Importuj 2 transakcji'));
    await waitFor(() => expect(api.addTransakcjeBatch).toHaveBeenCalled());
    expect(api.importujTransakcje).not.toHaveBeenCalled();
  });
});
