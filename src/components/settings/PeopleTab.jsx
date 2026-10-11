import { useState } from 'react';
import * as api from '../../services/api';
import { logger } from '../../utils/logger';
import { Icons } from '../Icons';
import { countTransactionsForOsoba } from './counts';

// Zakładka „Osoby" panelu ustawień: dodawanie i usuwanie osób.
export default function PeopleTab({ osoby, transakcje, onOsobyChange, isProcessing, setIsProcessing, showError, showSuccess, confirm }) {
  // Stan formularza nowej osoby
  const [newOsoba, setNewOsoba] = useState('');

  const countForOsoba = (osoba) => countTransactionsForOsoba(transakcje, osoba);

  const handleAddOsoba = async () => {
    const nazwa = newOsoba.trim();
    if (!nazwa) {
      showError('Wpisz nazwę osoby');
      return;
    }
    if (osoby.includes(nazwa)) {
      showError(`Osoba "${nazwa}" już istnieje`);
      return;
    }
    
    setIsProcessing(true);
    try {
      const result = await api.addOsoba(nazwa);

      if (result.success) {
        onOsobyChange([...osoby, nazwa]);
        setNewOsoba('');
        showSuccess(`Dodano osobę "${nazwa}"`);
      } else {
        showError(result.error || 'Nie udało się dodać osoby');
      }
    } catch (err) {
      showError('Błąd połączenia z serwerem');
      logger.error('App', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteOsoba = (osoba) => {
    const transCount = countForOsoba(osoba);
    
    if (transCount > 0) {
      confirm({
        title: 'Uwaga — osoba w użyciu!',
        message: `Osoba "${osoba}" ma przypisanych ${transCount} transakcji. Usunięcie nie usunie transakcji, ale osoba nie będzie dostępna w formularzu. Czy na pewno chcesz usunąć?`,
        isWarning: true,
        onConfirm: () => executeDeleteOsoba(osoba)
      });
    } else {
      confirm({
        title: 'Potwierdzenie usunięcia',
        message: `Czy na pewno chcesz usunąć osobę "${osoba}"?`,
        isWarning: false,
        onConfirm: () => executeDeleteOsoba(osoba)
      });
    }
  };
  
  const executeDeleteOsoba = async (osoba) => {
        setIsProcessing(true);
    
    try {
      const result = await api.deleteOsoba(osoba);

      if (result.success) {
        onOsobyChange(osoby.filter(o => o !== osoba));
        showSuccess(`Usunięto osobę "${osoba}"`);
      } else {
        showError(result.error || 'Nie udało się usunąć osoby');
      }
    } catch (err) {
      showError('Błąd połączenia z serwerem');
      logger.error('App', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Formularz dodawania osoby */}
      <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Dodaj osobę</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Imię lub nazwa osoby"
            value={newOsoba}
            onChange={e => setNewOsoba(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            onKeyDown={e => e.key === 'Enter' && handleAddOsoba()}
          />
          <button
            onClick={handleAddOsoba}
            disabled={isProcessing || !newOsoba.trim()}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? <Icons.Loader /> : <Icons.Plus />}
            Dodaj
          </button>
        </div>
      </div>
      
      {/* Lista osób */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
          Osoby ({osoby.length})
        </h3>
        {osoby.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Brak osób</p>
        ) : (
          <div className="space-y-2">
            {osoby.map(osoba => {
              const transCount = countForOsoba(osoba);
              return (
                <div key={osoba} className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
                    <Icons.User />
                  </div>
                  <span className="flex-1 font-medium text-gray-800">{osoba}</span>
                  {transCount > 0 && (
                    <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                      {transCount} trans.
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteOsoba(osoba)}
                    disabled={isProcessing}
                    className="rounded-lg p-2.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all disabled:opacity-50"
                    title={`Usuń osobę ${osoba}`}
                    aria-label={`Usuń osobę ${osoba}`}
                  >
                    <Icons.Trash />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
