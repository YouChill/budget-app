import { useState } from 'react';
import ModalShell from '../ModalShell';
import ConfirmDialog from '../ConfirmDialog';
import { Icons } from '../Icons';
import CategoriesTab from './CategoriesTab';
import PeopleTab from './PeopleTab';

// ============================================
// PANEL USTAWIEŃ - Zarządzanie słownikami
// ============================================
// Powłoka: zakładki, komunikaty sukcesu/błędu, wspólna blokada przycisków
// w trakcie zapisu i dialog potwierdzenia. Logika słowników w zakładkach.
export default function SettingsPanel({ onClose, kategorie, osoby, transakcje, onKategorieChange, onOsobyChange }) {
  const [activeTab, setActiveTab] = useState('kategorie');
  const [isProcessing, setIsProcessing] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Dialog potwierdzenia
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const showError = (msg) => {
    setSettingsError(msg);
    setTimeout(() => setSettingsError(null), 5000);
  };

  const tabProps = { transakcje, isProcessing, setIsProcessing, showError, showSuccess, confirm: setConfirmDialog };

  return (
    <>
      <ModalShell onClose={onClose} labelId="settings-title" maxWidth="max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2 text-white">
              <Icons.Settings />
            </div>
            <h2 id="settings-title" className="text-xl font-semibold text-gray-800">Ustawienia</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij ustawienia"
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Icons.X />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 shrink-0">
          <button
            onClick={() => setActiveTab('kategorie')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'kategorie'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icons.Tag />
            Kategorie
          </button>
          <button
            onClick={() => setActiveTab('osoby')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'osoby'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icons.User />
            Osoby
          </button>
        </div>

        {/* Komunikaty */}
        <div className="px-6 pt-3 shrink-0">
          {settingsError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-2">
              {settingsError}
            </div>
          )}
          {successMsg && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 mb-2">
              {successMsg}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Obie zakładki zamontowane — przełączanie nie gubi wpisanego tekstu
              ani rozwiniętych kategorii. */}
          <div hidden={activeTab !== 'kategorie'}>
            <CategoriesTab kategorie={kategorie} onKategorieChange={onKategorieChange} {...tabProps} />
          </div>
          <div hidden={activeTab !== 'osoby'}>
            <PeopleTab osoby={osoby} onOsobyChange={onOsobyChange} {...tabProps} />
          </div>
        </div>
      </ModalShell>

      {/* Dialog potwierdzenia — zamykany przed wykonaniem akcji */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          isWarning={confirmDialog.isWarning}
          onConfirm={() => {
            const { onConfirm } = confirmDialog;
            setConfirmDialog(null);
            onConfirm();
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  );
}
