import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../services/api', () => ({
  addKategoria: vi.fn(),
  deleteKategoria: vi.fn(),
  addOsoba: vi.fn(),
  deleteOsoba: vi.fn(),
}));

import * as api from '../../../services/api';
import SettingsPanel from '../SettingsPanel';

const kategorie = { Wydatek: { Jedzenie: ['Restauracje'] }, Przychód: {} };
const osoby = ['Paweł'];
const transakcje = [{ typ: 'Wydatek', kategoria: 'Jedzenie', podkategoria: 'Restauracje', osoba: 'Paweł' }];

describe('SettingsPanel', () => {
  let onKategorieChange;
  let onOsobyChange;

  beforeEach(() => {
    vi.clearAllMocks();
    onKategorieChange = vi.fn();
    onOsobyChange = vi.fn();
  });

  const renderPanel = () =>
    render(
      <SettingsPanel
        onClose={vi.fn()}
        kategorie={structuredClone(kategorie)}
        osoby={osoby}
        transakcje={transakcje}
        onKategorieChange={onKategorieChange}
        onOsobyChange={onOsobyChange}
      />
    );

  it('przełączanie zakładek nie gubi wpisanego tekstu', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByPlaceholderText('Nazwa kategorii (np. Jedzenie)'), 'Zdrowie');
    await user.click(screen.getByRole('button', { name: 'Osoby' }));
    expect(screen.getByPlaceholderText('Imię lub nazwa osoby')).toBeVisible();
    expect(screen.getByPlaceholderText('Nazwa kategorii (np. Jedzenie)')).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Kategorie' }));
    expect(screen.getByPlaceholderText('Nazwa kategorii (np. Jedzenie)')).toHaveValue('Zdrowie');
  });

  it('dodaje kategorię i pokazuje komunikat', async () => {
    api.addKategoria.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByPlaceholderText('Nazwa kategorii (np. Jedzenie)'), 'Zdrowie');
    await user.click(screen.getAllByRole('button', { name: 'Dodaj' })[0]);
    expect(api.addKategoria).toHaveBeenCalledWith('Wydatek', 'Zdrowie', '');
    expect(onKategorieChange).toHaveBeenCalledWith(expect.objectContaining({
      Wydatek: expect.objectContaining({ Zdrowie: [] }),
    }));
    expect(await screen.findByText('Dodano kategorię "Zdrowie"')).toBeInTheDocument();
  });

  it('usunięcie kategorii w użyciu: ostrzeżenie z liczbą transakcji, po potwierdzeniu API', async () => {
    api.deleteKategoria.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Usuń kategorię Jedzenie' }));
    expect(screen.getByText('Uwaga — kategoria w użyciu!')).toBeInTheDocument();
    expect(screen.getByText(/ma przypisanych 1 transakcji/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń' }));
    expect(api.deleteKategoria).toHaveBeenCalledWith('Wydatek', 'Jedzenie', null);
    expect(screen.queryByText('Uwaga — kategoria w użyciu!')).not.toBeInTheDocument();
    expect(await screen.findByText('Usunięto kategorię "Jedzenie"')).toBeInTheDocument();
  });

  it('nie dodaje istniejącej osoby', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: 'Osoby' }));
    await user.type(screen.getByPlaceholderText('Imię lub nazwa osoby'), 'Paweł');
    await user.keyboard('{Enter}');
    expect(api.addOsoba).not.toHaveBeenCalled();
    expect(screen.getByText('Osoba "Paweł" już istnieje')).toBeInTheDocument();
  });
});
