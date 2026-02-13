import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionItem from '../TransactionItem';
import TransactionForm from '../TransactionForm';

describe('TransactionItem Component', () => {
  const mockTransaction = {
    id: '1',
    data: '2026-02-13',
    typ: 'Wydatek',
    kwota: 100.50,
    kategoria: 'Jedzenie',
    podkategoria: 'Zakupy',
    osoba: 'Jan',
    komentarz: 'Promocja w Lidlu'
  };

  const mockOnDelete = vi.fn();
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renderuje kategorię, podkategorię, kwotę, datę, osobę', () => {
      render(
        <TransactionItem 
          transaction={mockTransaction} 
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      expect(screen.getByText('Jedzenie')).toBeInTheDocument();
      expect(screen.getByText(/Zakupy/)).toBeInTheDocument();
      expect(screen.getByText('Jan')).toBeInTheDocument();
      // Data może być w różnych formatach, szukamy po częściowym dopasowaniu
      const dateText = screen.queryAllByText(/2026/)[0];
      expect(dateText).toBeInTheDocument();
    });

    it('wyświetla komentarz gdy obecny', () => {
      render(
        <TransactionItem 
          transaction={mockTransaction} 
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Promocja w Lidlu')).toBeInTheDocument();
    });

    it('ukrywa komentarz gdy brak', () => {
      const transactionNoComment = { ...mockTransaction, komentarz: null };
      render(
        <TransactionItem 
          transaction={transactionNoComment} 
          onDelete={mockOnDelete}
        />
      );

      expect(screen.queryByText(/Promocja/)).not.toBeInTheDocument();
    });
  });

  describe('Styling - Expense vs Income', () => {
    it('wyświetla - i czerwony kolor dla wydatków', () => {
      const { container } = render(
        <TransactionItem 
          transaction={mockTransaction} 
          onDelete={mockOnDelete}
        />
      );

      const element = container.querySelector('[data-transaction-type="Wydatek"]');
      expect(element).toHaveClass('bg-rose-50');
      expect(screen.getByText(/- 100,50 zł/)).toBeInTheDocument();
    });

    it('wyświetla + i zielony kolor dla przychodów', () => {
      const incomeTransaction = { ...mockTransaction, typ: 'Przychód' };
      const { container } = render(
        <TransactionItem 
          transaction={incomeTransaction} 
          onDelete={mockOnDelete}
        />
      );

      const element = container.querySelector('[data-transaction-type="Przychód"]');
      expect(element).toHaveClass('bg-emerald-50');
      expect(screen.getByText(/\+ 100,50 zł/)).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('wywołuje onDelete z poprawnym ID po kliknięciu przycisku usuwania', async () => {
      render(
        <TransactionItem 
          transaction={mockTransaction} 
          onDelete={mockOnDelete}
        />
      );

      const deleteButton = screen.getByTestId('delete-1');
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith('1');
    });

    it('wywołuje onEdit z ID po kliknięciu edycji', async () => {
      render(
        <TransactionItem 
          transaction={mockTransaction} 
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      const editButton = screen.getByTestId('edit-1');
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith('1');
    });

    it('nie wyświetla przycisku edycji gdy onEdit nie podany', () => {
      render(
        <TransactionItem 
          transaction={mockTransaction} 
          onDelete={mockOnDelete}
        />
      );

      expect(screen.queryByTestId('edit-1')).not.toBeInTheDocument();
    });
  });
});

describe('TransactionForm Component', () => {
  const mockKategorie = {
    Wydatek: {
      'Jedzenie': ['Zakupy', 'Restauracja'],
      'Transport': []
    },
    Przychód: {
      'Pensja': [],
      'Bonusy': []
    }
  };

  const mockOsoby = ['Jan', 'Anna'];
  const mockOnSubmit = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renderuje pola: data, typ, kwota, kategoria, podkategoria, osoba, komentarz', () => {
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('field-data')).toBeInTheDocument();
      expect(screen.getByTestId('field-typ')).toBeInTheDocument();
      expect(screen.getByTestId('field-kwota')).toBeInTheDocument();
      expect(screen.getByTestId('field-kategoria')).toBeInTheDocument();
      expect(screen.getByTestId('field-osoba')).toBeInTheDocument();
      expect(screen.getByTestId('field-komentarz')).toBeInTheDocument();
    });

    it('presetuję domyślne wartości', () => {
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('field-typ')).toHaveValue('Wydatek');
      expect(screen.getByTestId('field-kwota')).toHaveValue(null);
    });
  });

  describe('Type and Category Change', () => {
    it('zmiana typu (Wydatek/Przychód) aktualizuje listę kategorii', async () => {
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      const typSelect = screen.getByTestId('field-typ');
      fireEvent.change(typSelect, { target: { value: 'Przychód' } });

      await waitFor(() => {
        const kategSelect = screen.getByTestId('field-kategoria');
        expect(kategSelect.textContent).toContain('Pensja');
        expect(kategSelect.textContent).toContain('Bonusy');
        expect(kategSelect.textContent).not.toContain('Transport');
      });
    });

    it('wybór kategorii aktualizuje listę podkategorii', async () => {
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      const kategSelect = screen.getByTestId('field-kategoria');
      fireEvent.change(kategSelect, { target: { value: 'Jedzenie' } });

      await waitFor(() => {
        expect(screen.getByTestId('field-podkategoria')).toBeInTheDocument();
        const podkategSelect = screen.getByTestId('field-podkategoria');
        expect(podkategSelect.textContent).toContain('Zakupy');
        expect(podkategSelect.textContent).toContain('Restauracja');
      });
    });

    it('nie wyświetla podkategorii gdy kategoria nie ma podziału', async () => {
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      const kategSelect = screen.getByTestId('field-kategoria');
      fireEvent.change(kategSelect, { target: { value: 'Transport' } });

      await waitFor(() => {
        expect(screen.queryByTestId('field-podkategoria')).not.toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('nie submituje z pustymi wymaganymi polami', async () => {
      const user = userEvent.setup();
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      const submitButton = screen.getByTestId('button-submit');
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/Kategoria jest wymagana/)).toBeInTheDocument();
      expect(screen.getByText(/Osoba jest wymagana/)).toBeInTheDocument();
    });

    it('waliduje kwotę > 0', async () => {
      const user = userEvent.setup();
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      const kwotaField = screen.getByTestId('field-kwota');
      await user.clear(kwotaField);
      await user.type(kwotaField, '0');

      const submitButton = screen.getByTestId('button-submit');
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/Kwota musi być większa od 0/)).toBeInTheDocument();
    });

    it('akceptuje poprawny formularz', async () => {
      const user = userEvent.setup();
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      const kategSelect = screen.getByTestId('field-kategoria');
      await user.selectOptions(kategSelect, 'Jedzenie');

      const osobaSelect = screen.getByTestId('field-osoba');
      await user.selectOptions(osobaSelect, 'Jan');

      const kwotaField = screen.getByTestId('field-kwota');
      await user.clear(kwotaField);
      await user.type(kwotaField, '100.50');

      const submitButton = screen.getByTestId('button-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          typ: 'Wydatek',
          kwota: 100.50,
          kategoria: 'Jedzenie',
          osoba: 'Jan'
        }));
      });
    });
  });

  describe('Submit and Close', () => {
    it('wywołuje onSubmit z poprawnymi danymi', async () => {
      const user = userEvent.setup();
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      const kategSelect = screen.getByTestId('field-kategoria');
      await user.selectOptions(kategSelect, 'Jedzenie');

      const osobaSelect = screen.getByTestId('field-osoba');
      await user.selectOptions(osobaSelect, 'Jan');

      const kwotaField = screen.getByTestId('field-kwota');
      await user.clear(kwotaField);
      await user.type(kwotaField, '150.75');

      const kommentarzField = screen.getByTestId('field-komentarz');
      await user.type(kommentarzField, 'Test komentarz');

      const submitButton = screen.getByTestId('button-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          kwota: 150.75,
          komentarz: 'Test komentarz'
        }));
      });
    });

    it('wywołuje onClose po kliknięciu anuluj', async () => {
      const user = userEvent.setup();
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByTestId('button-close');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('wyświetla stan ładowania (isLoading)', () => {
      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('field-data')).toBeDisabled();
      expect(screen.getByTestId('field-typ')).toBeDisabled();
      expect(screen.getByTestId('field-kwota')).toBeDisabled();
      expect(screen.getByTestId('button-submit')).toBeDisabled();
    });
  });

  describe('Editing', () => {
    it('presetuję dane do edycji z initialTransaction', () => {
      const initialTransaction = {
        data: '2026-02-13',
        typ: 'Przychód',
        kwota: 500,
        kategoria: 'Pensja',
        podkategoria: '',
        osoba: 'Anna',
        komentarz: 'Pensja za styczeń'
      };

      render(
        <TransactionForm
          kategorie={mockKategorie}
          osoby={mockOsoby}
          initialTransaction={initialTransaction}
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('field-data')).toHaveValue('2026-02-13');
      expect(screen.getByTestId('field-typ')).toHaveValue('Przychód');
      expect(screen.getByTestId('field-kwota')).toHaveValue(500);
      expect(screen.getByTestId('field-komentarz')).toHaveValue('Pensja za styczeń');
    });
  });
});
