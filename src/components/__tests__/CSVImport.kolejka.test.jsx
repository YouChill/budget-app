import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Kreator importu zapisuje wyciąg do kolejki (#131): plik → mapowanie +
// osoba → kolejka_dodaj → podsumowanie. Bez kategoryzacji i bez localStorage.

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getSession: vi.fn() } } }));
const api = vi.hoisted(() => ({
  getAliasyKontrahentow: vi.fn(),
  hmacRachunkow: vi.fn(),
  dodajDoKolejki: vi.fn(),
}));
vi.mock('../../services/api', () => api);

import CSVImport from '../CSVImport';
import { zrodloMillennium } from '../../lib/csvImport/banki';
import { rozroznijPowtorzenia, sha256Hex } from '../../lib/odciski';
import { usunStaryPostepImportu, STARY_KLUCZ_IMPORTU } from '../../lib/staryImport';

// Dane zmyślone — numery kont to ciągi cyfr bez znaczenia.
const KONTO_PLAY = '61109010140000071219812874';
const NAGLOWEK = '"Numer rachunku/karty","Data transakcji","Data rozliczenia","Rodzaj transakcji","Na konto/Z konta","Odbiorca/Zleceniodawca","Opis","Obciążenia","Uznania","Saldo","Waluta"';
const W1 = ['11 2222 3333 4444 5555 6666 7777', '2026-10-01', '2026-10-02', 'ZAKUP - FIZ. UŻYCIE KARTY', '', '', 'ŻABKA Z1  WARSZAWA POL 2026-10-01', '-12,50', '', '1000,00', 'PLN'];
const W2 = [...W1.slice(0, 9), '987,50', 'PLN'];
const W3 = ['11 2222 3333 4444 5555 6666 7777', '2026-10-03', '2026-10-03', 'PRZELEW WYCHODZĄCY', `PL${KONTO_PLAY}`, 'P4 SP. Z O.O.', 'F/60345080/09/26', '-119,98', '', '867,52', 'PLN'];
const millennium = [NAGLOWEK, ...[W1, W2, W3].map(r => r.map(c => `"${c}"`).join(','))].join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.getAliasyKontrahentow.mockResolvedValue([{ wzorzec: KONTO_PLAY, typ_wzorca: 'rachunek', kontrahent: 'play' }]);
  api.hmacRachunkow.mockImplementation(async (lista) => lista.map(() => 'f'.repeat(64)));
  api.dodajDoKolejki.mockImplementation(async (p) => ({ dodane: p.length, pominiete: 0 }));
});

async function importuj(plik, { onSaved = vi.fn(), onOpenKolejka, onClose = vi.fn(), mapuj } = {}) {
  const { container } = render(
    <CSVImport onClose={onClose} osoby={['Paweł', 'Teresa']} onSaved={onSaved} onOpenKolejka={onOpenKolejka} />
  );
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File([plik], 'wyciag.csv', { type: 'text/csv' })] },
  });
  await screen.findByText('Dopasuj kolumny do pól');
  if (mapuj) mapuj();
  fireEvent.change(screen.getByDisplayValue('— Wybierz osobę —'), { target: { value: 'Teresa' } });
  fireEvent.click(screen.getByText('Zapisz do kolejki →'));
}

describe('CSVImport → kolejka', () => {
  it('Millennium: kolejka_dodaj dostaje pozycje z odciskami jak przed zmianą', async () => {
    const onSaved = vi.fn();
    await importuj(millennium, { onSaved });
    await screen.findByText('Wyciąg w kolejce');

    const [pozycje] = api.dodajDoKolejki.mock.calls[0];
    const klucze = rozroznijPowtorzenia([W1, W2, W3].map(w => zrodloMillennium(w).klucz));
    const odciski = await Promise.all(klucze.map(k => sha256Hex(k)));
    expect(pozycje.map(p => p.zrodlo_id)).toEqual(odciski);
    expect(pozycje[0]).toMatchObject({ zrodlo: 'millennium', data: '2026-10-01', kwota_pelna: -12.5, osoba: 'Teresa', kontrahent: null, rachunek_hmac: null });
    expect(pozycje[0].opis).toMatch(/ŻABKA/);
    // kontrahent z aliasu na pełnym rachunku w pamięci + HMAC
    expect(pozycje[2]).toMatchObject({ kwota_pelna: -119.98, kontrahent: 'play', rachunek_hmac: 'f'.repeat(64) });
    expect(pozycje[2].surowe).toMatchObject({ kontrahent_konto: '2874' });
    // pozycja nie niesie kategorii — kategoryzacja dzieje się w kolejce
    expect(pozycje[0]).not.toHaveProperty('kategoria');
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByText(/Dodano do kolejki/)).toHaveTextContent('Dodano do kolejki: 3');
  });

  it('pełny numer rachunku trafia tylko do endpointu HMAC, nigdy do kolejki', async () => {
    await importuj(millennium);
    await screen.findByText('Wyciąg w kolejce');
    expect(api.hmacRachunkow).toHaveBeenCalledWith([`PL${KONTO_PLAY}`]);
    const json = JSON.stringify(api.dodajDoKolejki.mock.calls[0][0]);
    expect(json).not.toContain(KONTO_PLAY);
    expect(json).not.toContain('071219812874');
    expect(json).not.toContain('22223333');
  });

  it('endpoint HMAC niedostępny → import przechodzi z rachunek_hmac = null', async () => {
    api.hmacRachunkow.mockImplementation(async (lista) => lista.map(() => null));
    await importuj(millennium);
    await screen.findByText('Wyciąg w kolejce');
    const [pozycje] = api.dodajDoKolejki.mock.calls[0];
    expect(pozycje.map(p => p.rachunek_hmac)).toEqual([null, null, null]);
    expect(pozycje[2].kontrahent).toBe('play');
  });

  it('ponowny import tego samego pliku → 0 dodanych, N pominiętych', async () => {
    api.dodajDoKolejki.mockImplementation(async (p) => ({ dodane: 0, pominiete: p.length }));
    await importuj(millennium);
    await screen.findByText('Wyciąg w kolejce');
    expect(screen.getByText(/Dodano do kolejki/)).toHaveTextContent('Dodano do kolejki: 0');
    expect(screen.getByText(/Pominięto/)).toHaveTextContent('Pominięto (już w kolejce lub zaksięgowane): 3');
  });

  it('baza bez migracji kolejki → czytelny błąd, bez zapisu inną ścieżką', async () => {
    api.dodajDoKolejki.mockRejectedValue(Object.assign(new Error('Baza nie ma migracji kolejki importu'), { brakMigracji: true }));
    await importuj(millennium);
    expect(await screen.findByRole('alert')).toHaveTextContent('Baza nie ma migracji kolejki importu');
    expect(screen.queryByText('Wyciąg w kolejce')).not.toBeInTheDocument();
  });

  it('dowolny CSV z ręcznym mapowaniem: źródło csv, kwota ze znakiem', async () => {
    const csv = ['Data;Kwota;Opis;Saldo', '2026-10-01;-12,50;SKLEP XYZ 123;100', '2026-10-02;250,00;ZWROT;350'].join('\n');
    await importuj(csv, {
      mapuj: () => {
        const selects = screen.getAllByRole('combobox');
        fireEvent.change(selects[0], { target: { value: 'Data' } });
        fireEvent.change(selects[1], { target: { value: 'Kwota' } });
        fireEvent.change(selects[3], { target: { value: 'Opis' } });
      },
    });
    await screen.findByText('Wyciąg w kolejce');
    const [pozycje] = api.dodajDoKolejki.mock.calls[0];
    expect(pozycje.map(p => [p.zrodlo, p.data, p.kwota_pelna, p.opis])).toEqual([
      ['csv', '2026-10-01', -12.5, 'SKLEP XYZ 123'],
      ['csv', '2026-10-02', 250, 'ZWROT'],
    ]);
    expect(api.hmacRachunkow).not.toHaveBeenCalled();
  });

  it('„Przejdź do rozliczenia" zamyka kreator i otwiera kolejkę', async () => {
    const onClose = vi.fn();
    const onOpenKolejka = vi.fn();
    await importuj(millennium, { onClose, onOpenKolejka });
    fireEvent.click(await screen.findByText('Przejdź do rozliczenia'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenKolejka).toHaveBeenCalled();
  });

  it('kreator nic nie zapisuje w localStorage', async () => {
    await importuj(millennium);
    await screen.findByText('Wyciąg w kolejce');
    await waitFor(() => expect(localStorage.length).toBe(0));
  });
});

describe('sprzątanie autozapisu sprzed #131', () => {
  it('usuwa stary klucz z localStorage', () => {
    localStorage.setItem(STARY_KLUCZ_IMPORTU, JSON.stringify({ transactions: [{ opis: 'X', kwota: -1 }] }));
    localStorage.setItem('inne', '1');
    usunStaryPostepImportu();
    expect(localStorage.getItem(STARY_KLUCZ_IMPORTU)).toBeNull();
    expect(localStorage.getItem('inne')).toBe('1');
  });

  it('zablokowany localStorage nie rzuca', () => {
    expect(() => usunStaryPostepImportu({ removeItem: () => { throw new Error('SecurityError'); } })).not.toThrow();
  });
});

describe('kod bez autozapisu importu', () => {
  it('nie ma odwołań do useImportProgress', async () => {
    const pliki = import.meta.glob('../../**/*.{js,jsx}', { query: '?raw', import: 'default', eager: true });
    const zOdwolaniem = Object.entries(pliki)
      .filter(([sciezka]) => !sciezka.includes('__tests__'))
      .filter(([, kod]) => kod.includes('useImportProgress'));
    expect(zOdwolaniem.map(([s]) => s)).toEqual([]);
  });
});
