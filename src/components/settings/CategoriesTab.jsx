import { useState } from 'react';
import * as api from '../../services/api';
import { logger } from '../../utils/logger';
import { Icons } from '../Icons';
import { countTransactionsForCategory } from './counts';

// Zakładka „Kategorie" panelu ustawień: dodawanie i usuwanie kategorii
// oraz podkategorii. Komunikaty, blokada przycisków i dialog potwierdzenia
// należą do SettingsPanel (wspólne dla obu zakładek).
export default function CategoriesTab({ kategorie, transakcje, onKategorieChange, isProcessing, setIsProcessing, showError, showSuccess, confirm }) {
  // Stan formularza nowej kategorii
  const [newKatTyp, setNewKatTyp] = useState('Wydatek');
  const [newKatNazwa, setNewKatNazwa] = useState('');
  const [newPodkatNazwa, setNewPodkatNazwa] = useState('');

  // Stan rozwijanych kategorii
  const [expandedKat, setExpandedKat] = useState({});

  const countForCategory = (typ, kategoria, podkategoria = null) =>
    countTransactionsForCategory(transakcje, typ, kategoria, podkategoria);

  // Toggle rozwinięcia kategorii
  const toggleExpand = (key) => {
    setExpandedKat(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddKategoria = async () => {
    const nazwa = newKatNazwa.trim();
    const podkat = newPodkatNazwa.trim();
    
    if (!nazwa) {
      showError('Wpisz nazwę kategorii');
      return;
    }
    
    const istniejaceKategorie = kategorie[newKatTyp] || {};
    if (!podkat && istniejaceKategorie[nazwa]) {
      showError(`Kategoria "${nazwa}" już istnieje dla typu ${newKatTyp}`);
      return;
    }
    if (podkat && istniejaceKategorie[nazwa] && istniejaceKategorie[nazwa].includes(podkat)) {
      showError(`Podkategoria "${podkat}" już istnieje w "${nazwa}"`);
      return;
    }
    
    setIsProcessing(true);
    try {
      const result = await api.addKategoria(newKatTyp, nazwa, podkat);

      if (result.success) {
        const updated = { ...kategorie };
        if (!updated[newKatTyp]) updated[newKatTyp] = {};
        if (!updated[newKatTyp][nazwa]) updated[newKatTyp][nazwa] = [];
        if (podkat && !updated[newKatTyp][nazwa].includes(podkat)) {
          updated[newKatTyp][nazwa].push(podkat);
        }
        onKategorieChange(updated);
        
        setNewKatNazwa('');
        setNewPodkatNazwa('');
        showSuccess(podkat ? `Dodano podkategorię "${podkat}" do "${nazwa}"` : `Dodano kategorię "${nazwa}"`);
      } else {
        showError(result.error || 'Nie udało się dodać kategorii');
      }
    } catch (err) {
      showError('Błąd połączenia z serwerem');
      logger.error('App', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteKategoria = (typ, kategoria, podkategoria = null) => {
    const transCount = countForCategory(typ, kategoria, podkategoria);
    const label = podkategoria ? `podkategorię "${podkategoria}"` : `kategorię "${kategoria}" i wszystkie jej podkategorie`;
    
    if (transCount > 0) {
      confirm({
        title: 'Uwaga — kategoria w użyciu!',
        message: `${podkategoria ? 'Ta podkategoria' : 'Ta kategoria'} ma przypisanych ${transCount} transakcji. Usunięcie nie usunie transakcji, ale nie będą miały przypisanej kategorii w słowniku. Czy na pewno chcesz usunąć ${label}?`,
        isWarning: true,
        onConfirm: () => executeDeleteKategoria(typ, kategoria, podkategoria)
      });
    } else {
      confirm({
        title: 'Potwierdzenie usunięcia',
        message: `Czy na pewno chcesz usunąć ${label}?`,
        isWarning: false,
        onConfirm: () => executeDeleteKategoria(typ, kategoria, podkategoria)
      });
    }
  };
  
  const executeDeleteKategoria = async (typ, kategoria, podkategoria) => {
        setIsProcessing(true);
    
    try {
      const result = await api.deleteKategoria(typ, kategoria, podkategoria);

      if (result.success) {
        const updated = { ...kategorie };
        if (podkategoria) {
          updated[typ][kategoria] = updated[typ][kategoria].filter(p => p !== podkategoria);
        } else {
          delete updated[typ][kategoria];
        }
        onKategorieChange(updated);
        showSuccess(podkategoria ? `Usunięto podkategorię "${podkategoria}"` : `Usunięto kategorię "${kategoria}"`);
      } else {
        showError(result.error || 'Nie udało się usunąć kategorii');
      }
    } catch (err) {
      showError('Błąd połączenia z serwerem');
      logger.error('App', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render listy kategorii dla danego typu
  const renderKategorieList = (typ) => {
    const katTypu = kategorie[typ] || {};
    const entries = Object.entries(katTypu);
    
    if (entries.length === 0) {
      return <p className="text-sm text-gray-400 py-4 text-center">Brak kategorii</p>;
    }
    
    return entries.map(([nazwaKat, podkategorie]) => {
      const key = `${typ}:${nazwaKat}`;
      const isExpanded = expandedKat[key];
      const transCount = countForCategory(typ, nazwaKat);
      
      return (
        <div key={key} className="border border-gray-100 rounded-xl overflow-hidden mb-2">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/50">
            <button
              onClick={() => toggleExpand(key)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              {podkategorie.length > 0 ? (
                isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />
              ) : (
                <span className="w-4" />
              )}
              <span className="font-medium text-gray-800">{nazwaKat}</span>
              {podkategorie.length > 0 && (
                <span className="text-xs text-gray-400">({podkategorie.length})</span>
              )}
              {transCount > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                  {transCount} trans.
                </span>
              )}
            </button>
            <button
              onClick={() => handleDeleteKategoria(typ, nazwaKat)}
              disabled={isProcessing}
              className="rounded-lg p-2.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all disabled:opacity-50"
              title={`Usuń kategorię ${nazwaKat}`}
              aria-label={`Usuń kategorię ${nazwaKat}`}
            >
              <Icons.Trash />
            </button>
          </div>
          
          {isExpanded && podkategorie.length > 0 && (
            <div className="border-t border-gray-100">
              {podkategorie.map(podkat => {
                const podTransCount = countForCategory(typ, nazwaKat, podkat);
                return (
                  <div key={podkat} className="flex items-center gap-2 px-4 py-2.5 pl-10 hover:bg-gray-50 transition-colors">
                    <span className="flex-1 text-sm text-gray-600">{podkat}</span>
                    {podTransCount > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {podTransCount}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteKategoria(typ, nazwaKat, podkat)}
                      disabled={isProcessing}
                      className="rounded-lg p-2 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all disabled:opacity-50"
                      title={`Usuń podkategorię ${podkat}`}
                      aria-label={`Usuń podkategorię ${podkat}`}
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Formularz dodawania */}
      <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Dodaj kategorię / podkategorię</p>
        
        <div className="flex gap-2">
          {['Wydatek', 'Przychód'].map(typ => (
            <button
              key={typ}
              type="button"
              onClick={() => setNewKatTyp(typ)}
              className={`flex-1 rounded-xl py-2 px-3 text-sm font-medium transition-all ${
                newKatTyp === typ
                  ? typ === 'Wydatek'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {typ}
            </button>
          ))}
        </div>
        
        <input
          type="text"
          placeholder="Nazwa kategorii (np. Jedzenie)"
          value={newKatNazwa}
          onChange={e => setNewKatNazwa(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
          onKeyDown={e => e.key === 'Enter' && !newPodkatNazwa && handleAddKategoria()}
        />
        
        <input
          type="text"
          placeholder="Podkategoria — opcjonalnie (np. Restauracje)"
          value={newPodkatNazwa}
          onChange={e => setNewPodkatNazwa(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
          onKeyDown={e => e.key === 'Enter' && handleAddKategoria()}
        />
        
        <button
          onClick={handleAddKategoria}
          disabled={isProcessing || !newKatNazwa.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-2.5 text-sm font-medium text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? <Icons.Loader /> : <Icons.Plus />}
          Dodaj
        </button>
      </div>
      
      {/* Lista kategorii - Wydatki */}
      <div>
        <h3 className="text-sm font-semibold text-rose-600 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          Wydatki
        </h3>
        {renderKategorieList('Wydatek')}
      </div>
      
      {/* Lista kategorii - Przychody */}
      <div>
        <h3 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Przychody
        </h3>
        {renderKategorieList('Przychód')}
      </div>
    </div>
  );
}
