import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import CategoryCharts from '/components/CategoryCharts';
import Budgets from '/components/Budgets';
import CSVImport from '/components/CSVImport';
import LoginPage from './components/LoginPage';
import OfflineBanner from './components/OfflineBanner';
import YearlySummary from './components/YearlySummary';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { useOffline } from './hooks/useOffline';
import { useBudgets } from './hooks/useBudgets';
import { useAvailableYears } from './hooks/useAvailableYears';
import { addToQueue, getQueuedOperations, processQueue } from './services/offlineQueue';
import { supabase } from './lib/supabase';
import * as api from './services/api';
import { logger } from './utils/logger';
import {
  formatCurrency,
  getMonthName,
  getCurrentMonth,
  calculateIncome,
  calculateExpenses,
  sortTransactionsByDate,
  changeMonth as computeMonthChange,
} from './utils/calculations';

// Data format specyficzny dla UI (notacja kropkowa pl-PL, np. "13.02.2026").
// Różni się od utils/calculations.formatDate (slashes) używanego w testach
// i kontekstach nie-UI — dlatego celowo nie konsolidujemy.
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Ikony SVG
const Icons = {
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
  TrendingUp: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  ),
  TrendingDown: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
      <polyline points="17 18 23 18 23 12"></polyline>
    </svg>
  ),
  Wallet: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
    </svg>
  ),
  ChevronLeft: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  ),
  ChevronRight: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  ),
  ChevronDown: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  ),
  ChevronUp: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  ),
  X: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ),
  Trash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  Edit: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
      <path d="m15 5 4 4"></path>
    </svg>
  ),
  Settings: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
    </svg>
  ),
  User: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  ),
  Tag: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
      <line x1="7" y1="7" x2="7.01" y2="7"></line>
    </svg>
  ),
  AlertTriangle: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  ),
  Loader: () => (
    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
    </svg>
  ),
  Calendar: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Piggy: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2"/>
      <path d="M2 9.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0"/>
    </svg>
  )
};

// Komponent karty podsumowania
const SummaryCard = ({ title, amount, icon, type }) => {
  const colors = {
    income: 'from-emerald-500 to-teal-600',
    expense: 'from-rose-500 to-red-600',
    balance: 'from-indigo-500 to-purple-600'
  };
  
  // Renderuj ikonę jako komponent
  const renderIcon = () => icon();
  
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors[type]} p-4 sm:p-6 text-white shadow-lg`}>
      <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-white/10"></div>
      <div className="absolute right-0 bottom-0 -mr-8 -mb-8 h-32 w-32 rounded-full bg-white/5"></div>
      <div className="relative">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <div className="rounded-lg bg-white/20 p-1.5 sm:p-2">
            {renderIcon()}
          </div>
          <span className="text-sm font-medium text-white/80">{title}</span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{formatCurrency(amount)}</p>
      </div>
    </div>
  );
};

// Komponent formularza transakcji
const TransactionForm = ({ onSubmit, onClose, kategorie, osoby, isLoading, editData }) => {
  const isEditMode = !!editData;
  
  const [formData, setFormData] = useState(() => {
    if (editData) {
      // Normalizuj datę do formatu YYYY-MM-DD
      let normalizedDate = editData.data;
      if (editData.data) {
        const d = new Date(editData.data);
        if (!isNaN(d.getTime())) {
          normalizedDate = d.toISOString().split('T')[0];
        }
      }
      return {
        data: normalizedDate,
        typ: editData.typ || 'Wydatek',
        kwota: String(editData.kwota || ''),
        kategoria: editData.kategoria || '',
        podkategoria: editData.podkategoria || '',
        osoba: editData.osoba || osoby[0] || '',
        komentarz: editData.komentarz || ''
      };
    }
    return {
      data: new Date().toISOString().split('T')[0],
      typ: 'Wydatek',
      kwota: '',
      kategoria: '',
      podkategoria: '',
      osoba: osoby[0] || '',
      komentarz: ''
    };
  });
  
  const dostepneKategorie = kategorie[formData.typ] || {};
  const dostepnePodkategorie = dostepneKategorie[formData.kategoria] || [];
  
  // Handler zmiany typu - resetuje kategorię i podkategorię
  const handleTypChange = (typ) => {
    setFormData(prev => ({ 
      ...prev, 
      typ,
      kategoria: '',
      podkategoria: ''
    }));
  };
  
  // Handler zmiany kategorii - resetuje podkategorię
  const handleKategoriaChange = (kategoria) => {
    setFormData(prev => ({ 
      ...prev, 
      kategoria,
      podkategoria: ''
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.kwota || !formData.kategoria) return;
    onSubmit({
      ...formData,
      kwota: parseFloat(formData.kwota)
    });
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
      <div className="w-full max-w-md max-h-[95vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">
            {isEditMode ? 'Edytuj transakcję' : 'Nowa transakcja'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Icons.X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Typ transakcji */}
          <div className="flex gap-2">
            {['Wydatek', 'Przychód'].map(typ => (
              <button
                key={typ}
                type="button"
                onClick={() => handleTypChange(typ)}
                className={`flex-1 rounded-xl py-3 px-4 font-medium transition-all ${
                  formData.typ === typ
                    ? typ === 'Wydatek' 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                      : 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {typ}
              </button>
            ))}
          </div>
          
          {/* Data i kwota */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0 overflow-hidden">
              <label className="block text-sm font-medium text-gray-600 mb-2">Data</label>
              <input
                type="date"
                value={formData.data}
                onChange={e => setFormData(prev => ({ ...prev, data: e.target.value }))}
                className="w-full min-w-0 rounded-xl border border-gray-200 px-3 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Kwota (PLN)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.kwota}
                onChange={e => setFormData(prev => ({ ...prev, kwota: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                required
              />
            </div>
          </div>
          
          {/* Kategoria i podkategoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Kategoria</label>
              <select
                value={formData.kategoria}
                onChange={e => handleKategoriaChange(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                required
              >
                <option value="">Wybierz...</option>
                {Object.keys(dostepneKategorie).map(kat => (
                  <option key={kat} value={kat}>{kat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Podkategoria</label>
              <select
                value={formData.podkategoria}
                onChange={e => setFormData(prev => ({ ...prev, podkategoria: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                disabled={!formData.kategoria}
              >
                <option value="">Wybierz...</option>
                {dostepnePodkategorie.map(pod => (
                  <option key={pod} value={pod}>{pod}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Osoba */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Osoba</label>
            <div className="flex gap-2">
              {osoby.map(osoba => (
                <button
                  key={osoba}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, osoba }))}
                  className={`flex-1 rounded-xl py-3 px-4 font-medium transition-all ${
                    formData.osoba === osoba
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {osoba}
                </button>
              ))}
            </div>
          </div>
          
          {/* Komentarz */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Komentarz (opcjonalnie)</label>
            <input
              type="text"
              placeholder="np. zakupy w Biedronce"
              value={formData.komentarz}
              onChange={e => setFormData(prev => ({ ...prev, komentarz: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
          
          {/* Przycisk */}
          <button
            type="submit"
            disabled={isLoading || !formData.kwota || !formData.kategoria}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-4 font-semibold text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Icons.Loader /> Zapisywanie...</>
            ) : isEditMode ? (
              <><Icons.Edit /> Zapisz zmiany</>
            ) : (
              <><Icons.Plus /> Dodaj transakcję</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// Komponent pojedynczej transakcji
const TransactionItem = ({ transaction, onDelete, onEdit, isOffline, addToast }) => {
  const isExpense = transaction.typ === 'Wydatek';

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl bg-white p-3 sm:p-4 shadow-sm hover:bg-gray-50 transition-colors border border-gray-100">
      {/* Icon + Info */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`rounded-xl p-2.5 sm:p-3 shrink-0 ${isExpense ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
          {isExpense ? <Icons.TrendingDown /> : <Icons.TrendingUp />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-800">{transaction.kategoria}</p>
            {transaction.podkategoria && (
              <span className="text-sm text-gray-400 truncate">/ {transaction.podkategoria}</span>
            )}
          </div>
          <div className="flex items-center gap-x-2 gap-y-0.5 mt-1 flex-wrap">
            <span className="text-sm text-gray-500 whitespace-nowrap">{formatDate(transaction.data)}</span>
            <span className="text-gray-300">•</span>
            <span className="text-sm text-gray-500 whitespace-nowrap">{transaction.osoba}</span>
            {transaction.komentarz && (
              <>
                <span className="text-gray-300 hidden sm:inline">•</span>
                <span className="text-sm text-gray-400 truncate max-w-[200px] sm:max-w-[150px] basis-full sm:basis-auto">{transaction.komentarz}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Amount + Action buttons */}
      <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end pl-[52px] sm:pl-0">
        <p className={`text-base sm:text-lg font-semibold whitespace-nowrap ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
          {isExpense ? '-' : '+'}{formatCurrency(transaction.kwota)}
        </p>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => {
              if (isOffline) {
                addToast('W trybie offline nie możesz edytować transakcji', 'error');
                return;
              }
              onEdit(transaction);
            }}
            disabled={isOffline}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-[opacity,colors]"
            title="Edytuj"
          >
            <Icons.Edit />
          </button>
          <button
            onClick={() => {
              if (isOffline) {
                addToast('W trybie offline nie możesz usuwać transakcji', 'error');
                return;
              }
              onDelete(transaction.id);
            }}
            disabled={isOffline}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-[opacity,colors]"
            title="Usuń"
          >
            <Icons.Trash />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// PANEL USTAWIEŃ - Zarządzanie słownikami
// ============================================
const SettingsPanel = ({ onClose, kategorie, osoby, transakcje, onKategorieChange, onOsobyChange }) => {
  const [activeTab, setActiveTab] = useState('kategorie');
  const [isProcessing, setIsProcessing] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  // Stan formularza nowej kategorii
  const [newKatTyp, setNewKatTyp] = useState('Wydatek');
  const [newKatNazwa, setNewKatNazwa] = useState('');
  const [newPodkatNazwa, setNewPodkatNazwa] = useState('');
  
  // Stan formularza nowej osoby
  const [newOsoba, setNewOsoba] = useState('');
  
  // Stan rozwijanych kategorii
  const [expandedKat, setExpandedKat] = useState({});
  
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
  
  // Sprawdź ile transakcji ma dana kategoria/podkategoria
  const countTransactionsForCategory = (typ, kategoria, podkategoria = null) => {
    return transakcje.filter(t => {
      if (t.typ !== typ || t.kategoria !== kategoria) return false;
      if (podkategoria) return t.podkategoria === podkategoria;
      return true;
    }).length;
  };
  
  // Sprawdź ile transakcji ma dana osoba
  const countTransactionsForOsoba = (osoba) => {
    return transakcje.filter(t => t.osoba === osoba).length;
  };
  
  // Toggle rozwinięcia kategorii
  const toggleExpand = (key) => {
    setExpandedKat(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  // === KATEGORIE ===
  
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
    const transCount = countTransactionsForCategory(typ, kategoria, podkategoria);
    const label = podkategoria ? `podkategorię "${podkategoria}"` : `kategorię "${kategoria}" i wszystkie jej podkategorie`;
    
    if (transCount > 0) {
      setConfirmDialog({
        title: 'Uwaga — kategoria w użyciu!',
        message: `${podkategoria ? 'Ta podkategoria' : 'Ta kategoria'} ma przypisanych ${transCount} transakcji. Usunięcie nie usunie transakcji, ale nie będą miały przypisanej kategorii w słowniku. Czy na pewno chcesz usunąć ${label}?`,
        isWarning: true,
        onConfirm: () => executeDeleteKategoria(typ, kategoria, podkategoria)
      });
    } else {
      setConfirmDialog({
        title: 'Potwierdzenie usunięcia',
        message: `Czy na pewno chcesz usunąć ${label}?`,
        isWarning: false,
        onConfirm: () => executeDeleteKategoria(typ, kategoria, podkategoria)
      });
    }
  };
  
  const executeDeleteKategoria = async (typ, kategoria, podkategoria) => {
    setConfirmDialog(null);
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
  
  // === OSOBY ===
  
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
    const transCount = countTransactionsForOsoba(osoba);
    
    if (transCount > 0) {
      setConfirmDialog({
        title: 'Uwaga — osoba w użyciu!',
        message: `Osoba "${osoba}" ma przypisanych ${transCount} transakcji. Usunięcie nie usunie transakcji, ale osoba nie będzie dostępna w formularzu. Czy na pewno chcesz usunąć?`,
        isWarning: true,
        onConfirm: () => executeDeleteOsoba(osoba)
      });
    } else {
      setConfirmDialog({
        title: 'Potwierdzenie usunięcia',
        message: `Czy na pewno chcesz usunąć osobę "${osoba}"?`,
        isWarning: false,
        onConfirm: () => executeDeleteOsoba(osoba)
      });
    }
  };
  
  const executeDeleteOsoba = async (osoba) => {
    setConfirmDialog(null);
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
      const transCount = countTransactionsForCategory(typ, nazwaKat);
      
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
              className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all disabled:opacity-50"
              title={`Usuń kategorię ${nazwaKat}`}
            >
              <Icons.Trash />
            </button>
          </div>
          
          {isExpanded && podkategorie.length > 0 && (
            <div className="border-t border-gray-100">
              {podkategorie.map(podkat => {
                const podTransCount = countTransactionsForCategory(typ, nazwaKat, podkat);
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
                      className="rounded-lg p-1 text-gray-300 hover:bg-rose-100 hover:text-rose-600 transition-all disabled:opacity-50"
                      title={`Usuń podkategorię ${podkat}`}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] rounded-3xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2 text-white">
              <Icons.Settings />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Ustawienia</h2>
          </div>
          <button 
            onClick={onClose}
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
          {activeTab === 'kategorie' ? (
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
          ) : (
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
                      const transCount = countTransactionsForOsoba(osoba);
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
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all disabled:opacity-50"
                            title={`Usuń osobę ${osoba}`}
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
          )}
        </div>
      </div>
      
      {/* Dialog potwierdzenia */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              {confirmDialog.isWarning && (
                <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
                  <Icons.AlertTriangle />
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-800">{confirmDialog.title}</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition-all ${
                  confirmDialog.isWarning
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-rose-500 hover:bg-rose-600'
                }`}
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// GŁÓWNA APLIKACJA
// ============================================
export default function BudgetApp() {
  const { user, token, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { addToast } = useToast();
  const { isOffline } = useOffline();

  const [currentPeriod, setCurrentPeriod] = useState(getCurrentMonth());
  const [transakcje, setTransakcje] = useState([]);
  const [kategorie, setKategorie] = useState({ Wydatek: {}, Przychód: {} });
  const [osoby, setOsoby] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showBudgets, setShowBudgets] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => getQueuedOperations().length);
  const wasOfflineRef = useRef(isOffline);

  // Yearly summary view state
  const [activeView, setActiveView] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [showHint, setShowHint] = useState(() => !localStorage.getItem('yearlyViewHintSeen'));
  const [pulseActive, setPulseActive] = useState(() => !localStorage.getItem('yearlyViewHintSeen'));

  // Budżety dla bieżącego okresu — własny hook, niezależny od fetchData
  const { budgets, refresh: refreshBudgets } = useBudgets({
    month: currentPeriod.month,
    year: currentPeriod.year,
    enabled: isAuthenticated && !isOffline,
  });

  const availableYears = useAvailableYears({ enabled: isAuthenticated && !isOffline });

  // Auto-stop pulse animation after 5 seconds
  useEffect(() => {
    if (!pulseActive) return;
    const timer = setTimeout(() => setPulseActive(false), 5000);
    return () => clearTimeout(timer);
  }, [pulseActive]);

  // Handle yearly view toggle
  const handleToggleView = () => {
    setActiveView(v => v === 'monthly' ? 'yearly' : 'monthly');
    if (showHint) {
      setShowHint(false);
      setPulseActive(false);
      localStorage.setItem('yearlyViewHintSeen', 'true');
    }
  };

  // Pobierz wszystkie dane
  const fetchData = useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setIsLoading(true);
    }
    
    setError(null);

    // If offline, just show cached data if available — don't attempt network fetch
    if (!navigator.onLine) {
      setError('Brak połączenia z internetem.');
      setIsLoading(false);
      return;
    }

    // Pobierz świeże dane
    try {
      const data = await api.getAllData(currentPeriod.month, currentPeriod.year);

      // Aktualizuj stan
      const noweTransakcje = Array.isArray(data.transakcje) ? data.transakcje : [];
      const noweKategorie = data.kategorie || { Wydatek: {}, Przychód: {} };
      const noweOsoby = Array.isArray(data.osoby) ? data.osoby : [];

      setTransakcje(noweTransakcje);
      setKategorie(noweKategorie);
      setOsoby(noweOsoby);

    } catch (err) {
      setError('Nie udało się pobrać danych. Sprawdź połączenie i odśwież stronę.');
      logger.error('App', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPeriod]);

  // Ładuj dane przy starcie i zmianie miesiąca
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync queued operations when coming back online
  useEffect(() => {
    if (wasOfflineRef.current && !isOffline) {
      const syncQueue = async () => {
        const queue = getQueuedOperations();
        if (queue.length === 0) {
          wasOfflineRef.current = false;
          return;
        }
        setIsSyncing(true);
        try {
          const result = await processQueue();
          if (result.succeeded > 0) {
            addToast(`Zsynchronizowano ${result.succeeded} ${result.succeeded === 1 ? 'operację' : 'operacji'}`);
          }
          if (result.failed > 0) {
            addToast(`Nie udało się zsynchronizować ${result.failed} operacji`, 'error');
          }
          setPendingCount(0);
          // Refresh data from server after sync
          await fetchData(false);
        } finally {
          setIsSyncing(false);
        }
      };
      syncQueue();
    }
    wasOfflineRef.current = isOffline;
  }, [isOffline, fetchData, addToast]);

  // Real-time subscriptions — nasłuchuj zmian w Supabase
  useEffect(() => {
    if (isOffline || !user) return; // Skip if offline or not authenticated

    const getHouseholdId = async () => {
      try {
        const profile = await api.getUserProfile();
        return profile.household_id;
      } catch {
        return null;
      }
    };

    let subscriptions = [];

    const setupSubscriptions = async () => {
      const householdId = await getHouseholdId();
      if (!householdId) return;

      // Subscribe to transakcje changes
      const transakcjeChannel = supabase
        .channel(`transakcje:${householdId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transakcje',
            filter: `household_id=eq.${householdId}`,
          },
          (payload) => {
            // Odśwież dane gdy zmienią się transakcje
            fetchData(false);
          }
        )
        .subscribe();

      // Subscribe to kategorie changes
      const kategorieChannel = supabase
        .channel(`kategorie:${householdId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'kategorie',
            filter: `household_id=eq.${householdId}`,
          },
          (payload) => {
            // Odśwież dane gdy zmienią się kategorie
            fetchData(false);
          }
        )
        .subscribe();

      // Subscribe to osoby changes
      const osobyChannel = supabase
        .channel(`osoby:${householdId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'osoby',
            filter: `household_id=eq.${householdId}`,
          },
          (payload) => {
            // Odśwież dane gdy zmienią się osoby
            fetchData(false);
          }
        )
        .subscribe();

      subscriptions = [transakcjeChannel, kategorieChannel, osobyChannel];
    };

    setupSubscriptions();

    // Cleanup subscriptions on unmount
    return () => {
      subscriptions.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [user, isOffline, fetchData]);

  // Dodawanie transakcji
  const handleAddTransaction = async (transakcja) => {
    if (isOffline) {
      // Optimistic update + queue
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const optimistic = { ...transakcja, id: tempId, _offline: true };
      const noweTransakcje = [...transakcje, optimistic];
      setTransakcje(noweTransakcje);

      addToQueue({ action: 'addTransakcja', payload: { action: 'addTransakcja', transakcja } });
      setPendingCount(getQueuedOperations().length);

      setShowForm(false);
      addToast('Transakcja zapisana offline — zsynchronizuje się po połączeniu');
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.addTransakcja(transakcja);

      if (result.success) {
        await fetchData();
        setShowForm(false);
        addToast('Transakcja została dodana');
      } else {
        addToast('Nie udało się dodać transakcji', 'error');
      }
    } catch (err) {
      addToast('Błąd podczas zapisywania', 'error');
      logger.error('App', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Edycja transakcji
  const handleEditTransaction = async (transakcja) => {
    if (isOffline) {
      // Optimistic update + queue
      const noweTransakcje = transakcje.map(t =>
        t.id === editingTransaction.id ? { ...t, ...transakcja, _offline: true } : t
      );
      setTransakcje(noweTransakcje);

      addToQueue({
        action: 'updateTransakcja',
        payload: { action: 'updateTransakcja', id: editingTransaction.id, transakcja },
      });
      setPendingCount(getQueuedOperations().length);

      setEditingTransaction(null);
      setShowForm(false);
      addToast('Zmiana zapisana offline — zsynchronizuje się po połączeniu');
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.updateTransakcja(editingTransaction.id, transakcja);

      if (result.success) {
        await fetchData();
        setEditingTransaction(null);
        setShowForm(false);
        addToast('Transakcja została zaktualizowana');
      } else {
        addToast('Nie udało się zaktualizować transakcji', 'error');
      }
    } catch (err) {
      addToast('Błąd podczas aktualizacji', 'error');
      logger.error('App', err);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Otwórz formularz edycji
  const handleOpenEdit = (transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };
  
  // Zamknij formularz (reset trybu edycji)
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };
  
  // Usuwanie transakcji
  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę transakcję?')) return;

    if (isOffline) {
      // Optimistic update + queue
      const noweTransakcje = transakcje.filter(t => t.id !== id);
      setTransakcje(noweTransakcje);

      // Don't queue delete for temp (not-yet-synced) transactions
      if (!String(id).startsWith('temp_')) {
        addToQueue({ action: 'deleteTransakcja', payload: { action: 'deleteTransakcja', id } });
        setPendingCount(getQueuedOperations().length);
      }

      addToast('Usunięcie zapisane offline — zsynchronizuje się po połączeniu');
      return;
    }

    try {
      const result = await api.deleteTransakcja(id);
      if (result.success !== false) {
        await fetchData();
        addToast('Transakcja została usunięta');
      } else {
        addToast('Nie udało się usunąć transakcji', 'error');
      }
    } catch (err) {
      addToast('Błąd podczas usuwania', 'error');
      logger.error('App', err);
    }
  };
  
  // Nawigacja miesięcy
  const changeMonth = (delta) => {
    setCurrentPeriod(prev => computeMonthChange(prev.month, prev.year, delta));
  };
  
  // Callbacki dla ustawień — aktualizują stan
  const handleKategorieChange = (noweKategorie) => {
    setKategorie(noweKategorie);
  };
  
  const handleOsobyChange = (noweOsoby) => {
    setOsoby(noweOsoby);
  };
  
  // Obliczenia — memoizowane, korzystają z pure helperów z utils/calculations.
  const przychody = useMemo(() => calculateIncome(transakcje), [transakcje]);
  const wydatki = useMemo(() => calculateExpenses(transakcje), [transakcje]);
  const bilans = przychody - wydatki;

  const sortedTransakcje = useMemo(() => sortTransactionsByDate(transakcje), [transakcje]);
  
  // Auth gate: show login page if not authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Icons.Loader />
          <span>Ładowanie...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50">
      {/* Offline banner */}
      <OfflineBanner isOffline={isOffline} pendingCount={pendingCount} isSyncing={isSyncing} />

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-lg bg-white/70 border-b border-gray-200/50">
        <div className="max-w-4xl mx-auto px-3 py-2 sm:px-4 sm:py-4">
          {/* Top row: logo/title + action buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Flip icon toggle: Wallet (monthly) ↔ Calendar (yearly) */}
              <div className="relative">
                <button
                  onClick={handleToggleView}
                  className={`relative w-10 h-10 sm:w-11 sm:h-11 cursor-pointer shrink-0 ${pulseActive ? 'animate-pulse' : ''}`}
                  style={{ perspective: '600px' }}
                  title={activeView === 'monthly' ? 'Podsumowanie roku' : 'Widok miesięczny'}
                >
                  <div
                    className="absolute inset-0 transition-transform duration-500"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: activeView === 'yearly' ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}
                  >
                    {/* Front — Wallet */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2 sm:p-2.5 text-white shadow-lg flex items-center justify-center"
                         style={{ backfaceVisibility: 'hidden' }}>
                      <Icons.Wallet />
                    </div>
                    {/* Back — Calendar */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2 sm:p-2.5 text-white shadow-lg flex items-center justify-center"
                         style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <Icons.Calendar />
                    </div>
                  </div>
                </button>
                {/* One-time hint badge */}
                {showHint && (
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg z-50 pointer-events-none">
                    Kliknij, aby zobaczyć rok
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">Budżet Domowy</h1>
                <p className="text-sm text-gray-500 hidden sm:block">Kontroluj swoje finanse</p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Przycisk importu CSV */}
              <button
                onClick={() => !isOffline && setShowCSVImport(true)}
                className={`rounded-xl p-2 sm:p-2.5 transition-all ${isOffline ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-indigo-600'}`}
                title={isOffline ? 'Niedostępne offline' : 'Import z CSV'}
                disabled={isOffline}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              </button>

              {/* Przycisk budżetów */}
              <button
                onClick={() => !isOffline && setShowBudgets(true)}
                className={`rounded-xl p-2 sm:p-2.5 transition-all ${isOffline ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-indigo-600'}`}
                title={isOffline ? 'Niedostępne offline' : 'Budżety'}
                disabled={isOffline}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10v6a2 2 0 0 1-2 2H7"/><path d="M3 6h18"/><path d="M8 6v12"/></svg>
              </button>

              {/* Przycisk ustawień */}
              <button
                onClick={() => !isOffline && setShowSettings(true)}
                className={`rounded-xl p-2 sm:p-2.5 transition-all ${isOffline ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-indigo-600'}`}
                title={isOffline ? 'Niedostępne offline' : 'Ustawienia'}
                disabled={isOffline}
              >
                <Icons.Settings />
              </button>

              {/* User info & logout */}
              <div className="flex items-center gap-1.5 sm:gap-2 bg-white rounded-2xl shadow-sm border border-gray-100 px-2 py-1 sm:px-3 sm:py-1.5">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Icons.User />
                  </div>
                )}
                <span className="text-sm text-gray-600 hidden sm:inline max-w-[120px] truncate" title={user?.email}>
                  {user?.name || user?.email}
                </span>
                <button
                  onClick={logout}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all"
                  title="Wyloguj się"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation - monthly or yearly */}
          <div className="flex justify-center mt-2 sm:mt-2">
            {activeView === 'monthly' ? (
              <div className="flex items-center gap-1 sm:gap-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-1">
                <button
                  onClick={() => changeMonth(-1)}
                  className="rounded-xl p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Icons.ChevronLeft />
                </button>
                <span className="px-2 sm:px-3 py-1 text-sm font-medium text-gray-700 min-w-[130px] sm:min-w-[140px] text-center capitalize">
                  {getMonthName(currentPeriod.month, currentPeriod.year)}
                </span>
                <button
                  onClick={() => changeMonth(1)}
                  className="rounded-xl p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Icons.ChevronRight />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1 flex-wrap justify-center">
                {availableYears.map(y => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                      selectedYear === y
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Główna zawartość */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Komunikat błędu */}
        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-rose-700 text-sm">
            {error}
            <button 
              onClick={() => setError(null)} 
              className="ml-2 font-medium hover:underline"
            >
              Zamknij
            </button>
          </div>
        )}
        
        {activeView === 'yearly' ? (
          <YearlySummary year={selectedYear} />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-500">
              <Icons.Loader />
              <span>Ładowanie danych...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Karty podsumowania */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SummaryCard
                title="Przychody"
                amount={przychody}
                icon={Icons.TrendingUp}
                type="income"
              />
              <SummaryCard
                title="Wydatki"
                amount={wydatki}
                icon={Icons.TrendingDown}
                type="expense"
              />
              <SummaryCard
                title="Bilans"
                amount={bilans}
                icon={Icons.Wallet}
                type="balance"
              />
            </div>

            {/* Wykresy kategorii */}
            <CategoryCharts transakcje={transakcje} budgets={budgets} currentPeriod={currentPeriod} />

            {/* Lista transakcji */}
            <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800">
                  Transakcje ({transakcje.length})
                </h2>
                <button
                  onClick={() => {
                    if (isOffline) {
                      addToast('W trybie offline możesz tylko czytać dane z cache', 'error');
                      return;
                    }
                    setShowForm(true);
                  }}
                  disabled={isOffline}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icons.Plus />
                  Dodaj
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {sortedTransakcje.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="mb-2">Brak transakcji w tym miesiącu</p>
                    <button
                      onClick={() => {
                        if (isOffline) {
                          addToast('W trybie offline możesz tylko czytać dane z cache', 'error');
                          return;
                        }
                        setShowForm(true);
                      }}
                      disabled={isOffline}
                      className="text-indigo-600 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Dodaj pierwszą transakcję
                    </button>
                  </div>
                ) : (
                  sortedTransakcje.map(transaction => (
                    <TransactionItem
                      key={transaction.id}
                      transaction={transaction}
                      onDelete={handleDeleteTransaction}
                      onEdit={handleOpenEdit}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
      
      {/* Formularz */}
      {showForm && (
        <TransactionForm
          onSubmit={editingTransaction ? handleEditTransaction : handleAddTransaction}
          onClose={handleCloseForm}
          kategorie={kategorie}
          osoby={osoby}
          isLoading={isSaving}
          editData={editingTransaction}
        />
      )}
      
      {/* Panel ustawień */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          kategorie={kategorie}
          osoby={osoby}
          transakcje={transakcje}
          onKategorieChange={handleKategorieChange}
          onOsobyChange={handleOsobyChange}
        />
      )}

      {showBudgets && (
        <Budgets
          onClose={() => setShowBudgets(false)}
          kategorie={kategorie}
          month={currentPeriod.month}
          year={currentPeriod.year}
          budgets={budgets}
          osoby={osoby}
          onSaved={refreshBudgets}
        />
      )}

      {showCSVImport && (
        <CSVImport
          onClose={() => setShowCSVImport(false)}
          kategorie={kategorie}
          osoby={osoby}
          onSaved={() => {
            setShowCSVImport(false);
            fetchData();
          }}
        />
      )}
      
      {/* FAB dla mobile */}
      {!showForm && !isLoading && !isOffline && activeView === 'monthly' && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-6 right-6 md:hidden rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white shadow-2xl shadow-indigo-400 hover:scale-110 transition-transform"
        >
          <Icons.Plus />
        </button>
      )}
    </div>
  );
}