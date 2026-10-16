import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Test dymny złożenia App z hooków i komponentów: zalogowany użytkownik,
// API zamockowane, offline wyłączony.

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@test' },
    isAuthenticated: true,
    isLoading: false,
    isRecoveringPassword: false,
    logout: vi.fn(),
  }),
}));

vi.mock('../lib/supabase', () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { channel: () => channel, removeChannel: vi.fn() } };
});

vi.mock('../services/api', () => ({
  getAllData: vi.fn(),
  getBudgets: vi.fn().mockResolvedValue([]),
  getAvailableYears: vi.fn().mockResolvedValue([2026]),
  getUserProfile: vi.fn().mockResolvedValue({ household_id: 'h1' }),
  addTransakcja: vi.fn(),
  updateTransakcja: vi.fn(),
  deleteTransakcja: vi.fn(),
}));

// Wykresy (recharts) nie są przedmiotem tego testu.
vi.mock('../components/CategoryCharts', () => ({
  default: ({ onSelectCategory }) => (
    <button onClick={() => onSelectCategory('Transport')}>wykres: Transport</button>
  ),
}));

import * as api from '../services/api';
import { ToastProvider } from '../contexts/ToastContext';
import App from '../App';
import { getCurrentMonth } from '../utils/calculations';

const { month, year } = getCurrentMonth();
const d = (day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const dane = () => ({
  transakcje: [
    { id: 't1', data: d(2), typ: 'Wydatek', kwota: 40, kategoria: 'Jedzenie', podkategoria: null, osoba: 'Paweł', komentarz: 'Biedronka' },
    { id: 't2', data: d(1), typ: 'Wydatek', kwota: 10, kategoria: 'Transport', podkategoria: null, osoba: 'Paweł', komentarz: null },
    { id: 't3', data: d(1), typ: 'Przychód', kwota: 1000, kategoria: 'Wynagrodzenie', podkategoria: null, osoba: 'Paweł', komentarz: null },
  ],
  kategorie: { Wydatek: { Jedzenie: [], Transport: [] }, Przychód: { Wynagrodzenie: [] } },
  osoby: ['Paweł'],
});

const renderApp = () => render(<ToastProvider><App /></ToastProvider>);

describe('App — złożenie po podziale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAllData.mockResolvedValue(dane());
  });

  it('pokazuje podsumowanie i listę pogrupowaną po dniach', async () => {
    renderApp();
    expect(await screen.findByText('Transakcje (3)')).toBeInTheDocument();
    expect(screen.getByText('Biedronka')).toBeInTheDocument();
    expect(screen.getByText('Bilans')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2); // dwa dni
  });

  it('klik w kategorię na wykresie filtruje listę', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Transakcje (3)');
    await user.click(await screen.findByRole('button', { name: 'wykres: Transport' }));
    expect(screen.getByText('Transakcje (1 z 3)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Wyczyść filtr kategorii Transport' }));
    expect(screen.getByText('Transakcje (3)')).toBeInTheDocument();
  });

  it('dodanie transakcji: formularz → API → odświeżenie → zamknięcie', async () => {
    api.addTransakcja.mockResolvedValue({ success: true, id: 'n' });
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Transakcje (3)');

    await user.click(screen.getAllByRole('button', { name: 'Dodaj' })[0]);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Kwota (PLN)'), '12');
    await user.selectOptions(within(dialog).getByLabelText('Kategoria'), 'Transport');
    await user.click(within(dialog).getByRole('button', { name: /Dodaj transakcję/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.addTransakcja).toHaveBeenCalledWith(expect.objectContaining({ kwota: 12, kategoria: 'Transport', osoba: 'Paweł' }));
    expect(api.getAllData).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Transakcja została dodana')).toBeInTheDocument();
  });

  it('usunięcie wymaga potwierdzenia', async () => {
    api.deleteTransakcja.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Transakcje (3)');

    await user.click(screen.getByRole('button', { name: /Usuń transakcję Jedzenie/ }));
    expect(api.deleteTransakcja).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Usuń' }));
    await waitFor(() => expect(api.deleteTransakcja).toHaveBeenCalledWith('t1'));
  });
});
