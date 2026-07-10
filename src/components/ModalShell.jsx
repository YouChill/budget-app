import React, { useEffect, useRef } from 'react';

// Współdzielona powłoka modali: overlay + panel z semantyką dialogu
// (role="dialog", aria-modal), pułapką focusa, zamykaniem Escape i kliknięciem
// w tło oraz integracją z historią przeglądarki — systemowy „wstecz"
// (istotny w PWA na mobile) zamyka modal zamiast całej aplikacji.

// Stos otwartych modali współdzielony przez wszystkie instancje — na popstate
// reaguje wyłącznie modal na szczycie stosu (np. dialog potwierdzenia nad
// panelem ustawień zamyka się jako pierwszy).
const modalStack = [];
// Licznik popstate'ów do „skonsumowania" — history.back() wywołany przy
// zamknięciu modala nad innym modalem nie może zamknąć tego pod spodem.
let popsToConsume = 0;

function handlePopState() {
  if (popsToConsume > 0) {
    popsToConsume--;
    return;
  }
  const top = modalStack[modalStack.length - 1];
  if (top) {
    top.closedByPop = true;
    top.close();
  }
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ModalShell({
  onClose,
  children,
  labelId,
  ariaLabel,
  maxWidth = 'max-w-md',
  z = 'z-50',
  overlayTint = 'bg-black/50',
  sheet = true,
}) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Historia: otwarcie modala odkłada wpis, „wstecz" go zamyka; zamknięcie
  // w inny sposób (X, Escape, tło) konsumuje odłożony wpis przez history.back().
  useEffect(() => {
    const entry = { close: () => onCloseRef.current(), closedByPop: false };
    modalStack.push(entry);
    if (modalStack.length === 1) window.addEventListener('popstate', handlePopState);
    window.history.pushState({ modal: true }, '');
    return () => {
      modalStack.splice(modalStack.indexOf(entry), 1);
      if (modalStack.length === 0) window.removeEventListener('popstate', handlePopState);
      if (!entry.closedByPop) {
        // Tłumienie potrzebne tylko, gdy pod spodem został inny modal —
        // przy pustym stosie popstate i tak nic nie zamknie.
        if (modalStack.length > 0) popsToConsume++;
        window.history.back();
      }
    };
  }, []);

  // Focus: przenieś do pierwszego elementu panelu przy otwarciu,
  // przywróć poprzedni po zamknięciu.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector(FOCUSABLE_SELECTOR);
    (firstFocusable || panel)?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = panel.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={`fixed inset-0 ${z} flex ${
        sheet ? 'items-end sm:items-center sm:p-4' : 'items-center p-4'
      } justify-center ${overlayTint} backdrop-blur-sm`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`w-full ${maxWidth} max-h-[95vh] sm:max-h-[90vh] ${
          sheet ? 'rounded-t-3xl sm:rounded-3xl' : 'rounded-2xl'
        } bg-white shadow-2xl flex flex-col overflow-hidden outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
