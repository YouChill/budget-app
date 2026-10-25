import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Widok „Do rozliczenia" (#132).

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getSession: vi.fn() } } }));
vi.mock('../../services/categoryAI', () => ({
  isAIEnabled: vi.fn(() => false),
  categorizeWithAI: vi.fn(),
  saveCategoryRule: vi.fn(),
  saveCategoryRulesBatch: vi.fn(),
}));
const api = vi.hoisted(() => ({
  getKolejka: vi.fn(),
  getKontekstParowania: vi.fn(),
  zatwierdzKolejke: vi.fn(),
  ustawStatusKolejki: vi.fn(),
  getReguly: vi.fn(),
  addRegula: vi.fn(),
  deleteRegula: vi.fn(),
}));
vi.mock('../../services/api', () => api);

import Kolejka from '../kolejka/Kolejka';
import { ToastProvider } from '../../contexts/ToastContext';

const kategorie = {
  Wydatek: { Jedzenie: ['Zakupy domowe'], Rachunki: ['Telefon'], Inne: ['Nieprzewidziane'] },
  Przychód: {},
};

const D = {
  biedronka: { id: 'd-bie', zrodlo: 'millennium', data: '2026-10-01', kwota_pelna: -45.1, opis: 'BIEDRONKA 123', osoba: 'Paweł', kontrahent: null, dokument: null, rachunek_hmac: null, status: 'nowy' },
  play: { id: 'd-play', zrodlo: 'millennium', data: '2026-10-04', kwota_pelna: -119.98, opis: 'PRZELEW F/60345080/09/26', osoba: 'Paweł', kontrahent: null, dokument: null, rachunek_hmac: null, status: 'nowy' },
  xyz: { id: 'd-xyz', zrodlo: 'millennium', data: '2026-10-05', kwota_pelna: -9.99, opis: '<img src=x onerror=alert(1)> XYZ', osoba: 'Paweł', kontrahent: null, dokument: null, rachunek_hmac: null, status: 'nowy' },
};
const play = {
  id: 'z-play', kontrahent: 'play', dokument: 'F/60345080/09/26', kwota_pelna: 119.98,
  termin: '2026-10-05', kategoria: 'Rachunki', podkategoria: 'Telefon', udzial: '1/2', status: 'otwarte',
};

let wBazie;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  wBazie = [D.biedronka, D.play, D.xyz];
  api.getReguly.mockResolvedValue([]);
  api.getKolejka.mockImplementation(async ({ status = 'nowy' } = {}) =>
    (status === 'nowy' ? wBazie : [{ ...D.xyz, id: 'd-wyk', status: 'wykluczony', opis: 'PRZELEW WŁASNY' }]));
  api.getKontekstParowania.mockResolvedValue({ zobowiazania: [play], aliasy: [], bezDowodu: [] });
  api.ustawStatusKolejki.mockResolvedValue(1);
});

async function otworz(props = {}) {
  const utils = render(
    <ToastProvider>
      <Kolejka kategorie={kategorie} osoby={['Paweł', 'Teresa']} {...props} />
    </ToastProvider>
  );
  await screen.findByRole('tab', { name: /Wszystkie/ });
  return utils;
}

const wiersz = (tekst) => screen.getByDisplayValue(tekst).closest('tr');

describe('Kolejka — lista i propozycje', () => {
  it('ładuje tylko operacje w statusie nowy i liczy propozycje', async () => {
    await otworz();
    expect(api.getKolejka).toHaveBeenCalledWith();
    expect(api.getKontekstParowania).toHaveBeenCalledWith('2026-09-29', '2026-10-07', { hmacAliasow: true });

    // słownik: Biedronka → Jedzenie
    expect(within(wiersz('BIEDRONKA 123')).getByLabelText('Kategoria')).toHaveValue('Jedzenie');
    // zobowiązanie: kategoria + udział
    const rPlay = wiersz(/F\/60345080\/09\/26 \[udział 1\/2/);
    expect(within(rPlay).getByLabelText('Kategoria')).toHaveValue('Rachunki');
    expect(within(rPlay).getByText('-59,99 zł')).toBeInTheDocument();
    expect(within(rPlay).getByLabelText('Udział gospodarstwa')).toHaveValue('1/2');
    // bez dopasowania — niezaznaczony
    expect(screen.getByRole('checkbox', { name: /XYZ/ })).not.toBeChecked();
    expect(screen.getByText('Zatwierdź 2')).toBeInTheDocument();
  });

  it('opis z banku renderowany jako tekst, nie HTML', async () => {
    const { container } = await otworz();
    expect(screen.getByDisplayValue('<img src=x onerror=alert(1)> XYZ')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('Kolejka — zatwierdzanie', () => {
  it('wysyła poprawny payload (udział, kwota_pelna, zobowiazanie_id) i odświeża dane', async () => {
    const onZmiana = vi.fn();
    api.zatwierdzKolejke.mockImplementation(async (p) => {
      wBazie = [D.xyz];
      return { zatwierdzone: p.length, dolaczone: 0, pominiete: 0, polaczone: 1, wyniki: p.map(x => ({ status: 'dodana', dowod_id: x.dowod_id })) };
    });
    await otworz({ onZmiana });
    // osoba z dowodu, zmiana na inną z listy
    fireEvent.change(within(wiersz('BIEDRONKA 123')).getByLabelText('Osoba'), { target: { value: 'Teresa' } });
    fireEvent.click(screen.getByText('Zatwierdź 2'));

    await waitFor(() => expect(api.zatwierdzKolejke).toHaveBeenCalled());
    const [pozycje] = api.zatwierdzKolejke.mock.calls[0];
    expect(pozycje).toEqual([
      {
        dowod_id: 'd-bie', zobowiazanie_id: null, transakcja_id: null,
        transakcja: { data: '2026-10-01', typ: 'Wydatek', kwota: 45.1, kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe', osoba: 'Teresa', komentarz: 'BIEDRONKA 123', kwota_pelna: null, udzial: null },
      },
      {
        dowod_id: 'd-play', zobowiazanie_id: 'z-play', transakcja_id: null,
        transakcja: { data: '2026-10-04', typ: 'Wydatek', kwota: 59.99, kategoria: 'Rachunki', podkategoria: 'Telefon', osoba: 'Paweł', komentarz: 'PRZELEW F/60345080/09/26 [udział 1/2 z 119,98 zł]', kwota_pelna: 119.98, udzial: '1/2' },
      },
    ]);
    expect(await screen.findByText('Zatwierdzono 2 operacji')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByDisplayValue('BIEDRONKA 123')).not.toBeInTheDocument());
    expect(screen.getByDisplayValue(/XYZ/)).toBeInTheDocument();
    expect(onZmiana).toHaveBeenCalled();
  });

  it('pominieta (zatwierdzone na innym urządzeniu) — toast, bez błędu, lista odświeżona', async () => {
    api.zatwierdzKolejke.mockImplementation(async () => {
      wBazie = [D.xyz];
      return {
        zatwierdzone: 1, dolaczone: 0, pominiete: 1, polaczone: 0,
        wyniki: [{ status: 'dodana', dowod_id: 'd-bie' }, { status: 'pominieta', dowod_id: 'd-play' }],
      };
    });
    await otworz();
    fireEvent.click(screen.getByText('Zatwierdź 2'));
    expect(await screen.findByText(/już rozliczonych na innym urządzeniu/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByDisplayValue(/F\/60345080/)).not.toBeInTheDocument());
    expect(api.getKolejka).toHaveBeenCalledTimes(2);
  });

  it('zgłasza niezatwierdzone zmiany do rodzica', async () => {
    const onDirtyChange = vi.fn();
    await otworz({ onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(within(wiersz(/XYZ/)).getByLabelText('Kategoria'), { target: { value: 'Jedzenie' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    // wybór kategorii zaznacza wiersz do zatwierdzenia
    expect(screen.getByRole('checkbox', { name: /XYZ/ })).toBeChecked();
    expect(localStorage.length).toBe(0);
  });
});

describe('Kolejka — wykluczanie i przywracanie', () => {
  it('wyklucz zmienia status i odświeża licznik', async () => {
    const onZmiana = vi.fn();
    await otworz({ onZmiana });
    wBazie = [D.biedronka, D.play];
    fireEvent.click(screen.getByRole('button', { name: 'Wyklucz operację z 2026-10-05' }));
    await waitFor(() => expect(api.ustawStatusKolejki).toHaveBeenCalledWith(['d-xyz'], 'wykluczony'));
    await waitFor(() => expect(screen.queryByDisplayValue(/XYZ/)).not.toBeInTheDocument());
    expect(onZmiana).toHaveBeenCalled();
  });

  it('zakładka Wykluczone → Przywróć wraca operację do kolejki', async () => {
    const onZmiana = vi.fn();
    await otworz({ onZmiana });
    fireEvent.click(screen.getByRole('tab', { name: 'Wykluczone' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Przywróć operację z 2026-10-05' }));
    await waitFor(() => expect(api.ustawStatusKolejki).toHaveBeenCalledWith(['d-wyk'], 'nowy'));
    expect(api.getKolejka).toHaveBeenCalledWith({ status: 'wykluczony' });
    expect(onZmiana).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Do rozliczenia' }));
    expect(await screen.findByDisplayValue('PRZELEW WŁASNY')).toBeInTheDocument();
  });
});

describe('bezpieczeństwo UI', () => {
  it('w src/ nie ma dangerouslySetInnerHTML', () => {
    const src = join(process.cwd(), 'src');
    const pliki = [];
    const przejdz = (dir) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) { if (n !== '__tests__') przejdz(p); }
        else if (/\.(jsx?|tsx?)$/.test(n)) pliki.push(p);
      }
    };
    przejdz(src);
    const zle = pliki.filter(p => readFileSync(p, 'utf8').includes('dangerouslySetInnerHTML'));
    expect(zle).toEqual([]);
  });
});
