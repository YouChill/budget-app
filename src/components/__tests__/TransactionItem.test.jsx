import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionItem from '../TransactionItem';
import TransactionForm from '../TransactionForm';

// Testy komponentów faktycznie używanych przez aplikację (wydzielonych
// z App.jsx). Wcześniejsze testy dotyczyły nieużywanych kopii tych komponentów.

const wydatek = {
  id: 'tx-1',
  data: '2026-02-13',
  typ: 'Wydatek',
  kwota: 125.5,
  kategoria: 'Jedzenie',
  podkategoria: 'Restauracje',
  osoba: 'Paweł',
  komentarz: 'Obiad',
};

describe('TransactionItem', () => {
  let onDelete;
  let onEdit;

  beforeEach(() => {
    onDelete = vi.fn();
    onEdit = vi.fn();
  });

  it('renderuje kategorię, podkategorię, datę, osobę i komentarz', () => {
    render(<TransactionItem transaction={wydatek} onDelete={onDelete} onEdit={onEdit} />);
    expect(screen.getByText('Jedzenie')).toBeInTheDocument();
    expect(screen.getByText('/ Restauracje')).toBeInTheDocument();
    expect(screen.getByText('13.02.2026')).toBeInTheDocument();
    expect(screen.getByText('Paweł')).toBeInTheDocument();
    expect(screen.getByText('Obiad')).toBeInTheDocument();
  });

  it('bez podkategorii i komentarza nie renderuje ich', () => {
    const tx = { ...wydatek, podkategoria: null, komentarz: null };
    render(<TransactionItem transaction={tx} onDelete={onDelete} onEdit={onEdit} />);
    expect(screen.queryByText(/^\/ /)).not.toBeInTheDocument();
    expect(screen.queryByText('Obiad')).not.toBeInTheDocument();
  });

  it('wydatek: minus i kolor czerwony', () => {
    render(<TransactionItem transaction={wydatek} onDelete={onDelete} onEdit={onEdit} />);
    const kwota = screen.getByText(/^-/);
    expect(kwota.textContent).toMatch(/125,50/);
    expect(kwota.className).toContain('text-rose-600');
  });

  it('przychód: plus i kolor zielony', () => {
    const tx = { ...wydatek, typ: 'Przychód', kwota: 5000 };
    render(<TransactionItem transaction={tx} onDelete={onDelete} onEdit={onEdit} />);
    const kwota = screen.getByText(/^\+/);
    expect(kwota.className).toContain('text-emerald-600');
  });

  it('usuwanie przekazuje id, edycja — całą transakcję', async () => {
    const user = userEvent.setup();
    render(<TransactionItem transaction={wydatek} onDelete={onDelete} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /Usuń transakcję Jedzenie z 13\.02\.2026/ }));
    expect(onDelete).toHaveBeenCalledWith('tx-1');

    await user.click(screen.getByRole('button', { name: /Edytuj transakcję Jedzenie/ }));
    expect(onEdit).toHaveBeenCalledWith(wydatek);
  });
});

describe('TransactionForm', () => {
  const kategorie = {
    Wydatek: { Jedzenie: ['Restauracje', 'Zakupy'], Transport: [] },
    Przychód: { Wynagrodzenie: ['Pensja'] },
  };
  const osoby = ['Paweł', 'Ania'];
  let onSubmit;
  let onClose;

  beforeEach(() => {
    onSubmit = vi.fn();
    onClose = vi.fn();
  });

  const renderForm = (props = {}) =>
    render(
      <TransactionForm
        onSubmit={onSubmit}
        onClose={onClose}
        kategorie={kategorie}
        osoby={osoby}
        isLoading={false}
        editData={null}
        {...props}
      />
    );

  const optionValues = (select) =>
    within(select).getAllByRole('option').map(o => o.value).filter(Boolean);

  it('nowa transakcja: tytuł, domyślnie Wydatek i pierwsza osoba', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'Nowa transakcja' })).toBeInTheDocument();
    expect(optionValues(screen.getByLabelText('Kategoria'))).toEqual(['Jedzenie', 'Transport']);
    expect(screen.getByRole('button', { name: 'Paweł' }).className).toContain('bg-indigo-500');
    expect(screen.getByLabelText('Data').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('zmiana typu podmienia listę kategorii i zeruje wybór', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByLabelText('Kategoria'), 'Jedzenie');
    await user.click(screen.getByRole('button', { name: 'Przychód' }));

    const kategoria = screen.getByLabelText('Kategoria');
    expect(optionValues(kategoria)).toEqual(['Wynagrodzenie']);
    expect(kategoria.value).toBe('');
  });

  it('podkategorie zależą od kategorii; bez kategorii pole wyłączone', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByLabelText('Podkategoria')).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Kategoria'), 'Jedzenie');
    expect(optionValues(screen.getByLabelText('Podkategoria'))).toEqual(['Restauracje', 'Zakupy']);

    await user.selectOptions(screen.getByLabelText('Kategoria'), 'Transport');
    expect(optionValues(screen.getByLabelText('Podkategoria'))).toEqual([]);
  });

  it('przycisk zapisu nieaktywny bez kwoty i kategorii', async () => {
    const user = userEvent.setup();
    renderForm();
    const submit = screen.getByRole('button', { name: /Dodaj transakcję/ });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Kwota (PLN)'), '10');
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Kategoria'), 'Transport');
    expect(submit).toBeEnabled();
  });

  it('wysyła dane z kwotą jako liczbą', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.clear(screen.getByLabelText('Data'));
    await user.type(screen.getByLabelText('Data'), '2026-03-05');
    await user.type(screen.getByLabelText('Kwota (PLN)'), '42.50');
    await user.selectOptions(screen.getByLabelText('Kategoria'), 'Jedzenie');
    await user.selectOptions(screen.getByLabelText('Podkategoria'), 'Zakupy');
    await user.click(screen.getByRole('button', { name: 'Ania' }));
    await user.type(screen.getByLabelText('Komentarz (opcjonalnie)'), 'Biedronka');
    await user.click(screen.getByRole('button', { name: /Dodaj transakcję/ }));

    expect(onSubmit).toHaveBeenCalledWith({
      data: '2026-03-05',
      typ: 'Wydatek',
      kwota: 42.5,
      kategoria: 'Jedzenie',
      podkategoria: 'Zakupy',
      osoba: 'Ania',
      komentarz: 'Biedronka',
    });
  });

  it('tryb edycji: dane wstępnie wypełnione, data znormalizowana', () => {
    renderForm({ editData: { ...wydatek, data: '2026-02-13T00:00:00Z' } });
    expect(screen.getByRole('heading', { name: 'Edytuj transakcję' })).toBeInTheDocument();
    expect(screen.getByLabelText('Data').value).toBe('2026-02-13');
    expect(screen.getByLabelText('Kwota (PLN)').value).toBe('125.5');
    expect(screen.getByLabelText('Kategoria').value).toBe('Jedzenie');
    expect(screen.getByLabelText('Podkategoria').value).toBe('Restauracje');
    expect(screen.getByLabelText('Komentarz (opcjonalnie)').value).toBe('Obiad');
    expect(screen.getByRole('button', { name: /Zapisz zmiany/ })).toBeEnabled();
  });

  it('w trakcie zapisu przycisk pokazuje „Zapisywanie" i jest nieaktywny', () => {
    renderForm({ isLoading: true, editData: wydatek });
    const submit = screen.getByRole('button', { name: /Zapisywanie/ });
    expect(submit).toBeDisabled();
  });

  it('przycisk zamknięcia woła onClose', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Zamknij formularz' }));
    expect(onClose).toHaveBeenCalled();
  });
});
