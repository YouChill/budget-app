import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModalShell from '../ModalShell';
import ConfirmDialog from '../ConfirmDialog';

describe('ModalShell', () => {
  let onClose;

  beforeEach(() => {
    onClose = vi.fn();
  });

  it('renderuje dialog z semantyką ARIA', () => {
    render(
      <ModalShell onClose={onClose} ariaLabel="Testowy dialog">
        <button>OK</button>
      </ModalShell>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Testowy dialog');
  });

  it('przenosi focus do pierwszego elementu w modalu', () => {
    render(
      <ModalShell onClose={onClose} ariaLabel="Dialog">
        <button>Pierwszy</button>
        <button>Drugi</button>
      </ModalShell>
    );
    expect(document.activeElement).toBe(screen.getByText('Pierwszy'));
  });

  it('zamyka modal klawiszem Escape', () => {
    render(
      <ModalShell onClose={onClose} ariaLabel="Dialog">
        <button>OK</button>
      </ModalShell>
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('zamyka modal kliknięciem w tło (ale nie w panel)', () => {
    render(
      <ModalShell onClose={onClose} ariaLabel="Dialog">
        <button>OK</button>
      </ModalShell>
    );
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('zamyka modal na popstate (przycisk wstecz)', () => {
    render(
      <ModalShell onClose={onClose} ariaLabel="Dialog">
        <button>OK</button>
      </ModalShell>
    );
    fireEvent.popState(window);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('na popstate zamyka tylko modal na szczycie stosu', () => {
    const onCloseBottom = vi.fn();
    const onCloseTop = vi.fn();
    render(
      <>
        <ModalShell onClose={onCloseBottom} ariaLabel="Dolny">
          <button>A</button>
        </ModalShell>
        <ModalShell onClose={onCloseTop} ariaLabel="Górny">
          <button>B</button>
        </ModalShell>
      </>
    );
    fireEvent.popState(window);
    expect(onCloseTop).toHaveBeenCalledTimes(1);
    expect(onCloseBottom).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  it('renderuje tytuł, treść i wywołuje callbacki', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Usunąć element?"
        message="Tej operacji nie można cofnąć."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('Usunąć element?')).toBeInTheDocument();
    expect(screen.getByText('Tej operacji nie można cofnąć.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Anuluj'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Usuń'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('obsługuje własne etykiety i wariant ostrzegawczy', () => {
    render(
      <ConfirmDialog
        title="Nadpisanie budżetu"
        message="Istnieje budżet roczny."
        confirmLabel="Nadpisz"
        cancelLabel="Wróć"
        isWarning
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('Nadpisz')).toBeInTheDocument();
    expect(screen.getByText('Wróć')).toBeInTheDocument();
  });
});
