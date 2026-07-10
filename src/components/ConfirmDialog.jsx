import React from 'react';
import ModalShell from './ModalShell';

const WarningIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// Wspólny dialog potwierdzenia — zastępuje window.confirm/alert, spójny
// wygląd we wszystkich flow (usuwanie transakcji, budżetów, słowników,
// nadpisanie budżetu rocznego, przywracanie postępu importu).
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Usuń',
  cancelLabel = 'Anuluj',
  isWarning = false,
  onConfirm,
  onCancel,
}) {
  return (
    <ModalShell
      onClose={onCancel}
      ariaLabel={title}
      maxWidth="max-w-sm"
      z="z-[60]"
      overlayTint="bg-black/60"
      sheet={false}
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          {isWarning && (
            <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
              <WarningIcon />
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-all ${
              isWarning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
