import React, { useState, useEffect, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';

const API_URL = import.meta.env.VITE_API_URL;

// Pomocnicze funkcje
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN'
  }).format(amount);
};

/**
 * Formatuje datę z formatu YYYY-MM-DD na string w formacie DD-MM-RRRR
 * Jawnie parsuje datę bez new Date() aby uniknąć problemów ze strefą czasową
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  // Sprawdź czy to format YYYY-MM-DD
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-');
    // Stwórz datę z jawnie podanymi komponentami aby uniknąć interpretacji strefy czasowej
    // Używamy new Date(year, month-1, day) zamiast new Date(string)
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  
  // Fallback jeśli format jest inny
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateString;
  }
};

/**
 * Parsuje datę z formatu YYYY-MM-DD bezpośrednio bez niejawnej konwersji
 */
const parseDate = (dateString) => {
  if (!dateString) return new Date();
  
  // Jeśli format to YYYY-MM-DD, parsuj jawnie
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Fallback
  return new Date(dateString);
};

const getCurrentMonth = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

const getMonthName = (month, year) => {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
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
  Loader: () => (
    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
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
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors[type]} p-6 text-white shadow-lg`}>
      <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-white/10"></div>
      <div className="absolute right-0 bottom-0 -mr-8 -mb-8 h-32 w-32 rounded-full bg-white/5"></div>
      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-lg bg-white/20 p-2">
            {renderIcon()}
          </div>
          <span className="text-sm font-medium text-white/80">{title}</span>
        </div>
        <p className="text-3xl font-bold tracking-tight">{formatCurrency(amount)}</p>
      </div>
    </div>
  );
};

// Komponent formularza transakcji
const TransactionForm = ({ onSubmit, onClose, kategorie, osoby, isLoading }) => {
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    typ: 'Wydatek',
    kwota: '',
    kategoria: '',
    podkategoria: '',
    osoba: osoby[0] || '',
    komentarz: ''
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Nowa transakcja</h2>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Icons.X />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Data</label>
              <input
                type="date"
                value={formData.data}
                onChange={e => setFormData(prev => ({ ...prev, data: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Kwota (PLN)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={formData.kwota}
                onChange={e => setFormData(prev => ({ ...prev, kwota: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                required
              />
            </div>
          </div>
          
          {/* Kategoria i podkategoria */}
          <div className="grid grid-cols-2 gap-4">
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
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-4 font-semibold text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? <Icons.Loader /> : <Icons.Plus />}
            {isLoading ? 'Zapisywanie...' : 'Dodaj transakcję'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Komponent pojedynczej transakcji
const TransactionItem = ({ transaction, onDelete }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const isExpense = transaction.typ === 'Wydatek';
  
  const handlers = useSwipeable({
    onSwipedRight: () => {
      if (window.confirm('Usunąć tę transakcję?')) {
        onDelete(transaction.id);
      }
      setSwipeOffset(0);
    },
    onSwiping: (eventData) => {
      // Tylko w prawo i max 100px
      if (eventData.deltaX > 0) {
        setSwipeOffset(Math.min(eventData.deltaX, 100));
      }
    },
    onSwiped: () => {
      setSwipeOffset(0);
    },
    trackMouse: false, // Tylko touch, nie mysz
    delta: 10 // Minimalna odległość do wykrycia swipe
  });
  
  return (
    <div 
      {...handlers}
      className="group relative flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
      style={{
        transform: `translateX(${swipeOffset}px)`,
        transition: swipeOffset === 0 ? 'transform 0.2s ease-out' : 'none'
      }}
    >
      {/* Tło z ikoną usuwania - pokazuje się przy swipe */}
      {swipeOffset > 0 && (
        <div 
          className="absolute left-0 top-0 bottom-0 flex items-center px-4 text-rose-500"
          style={{ width: `${swipeOffset}px` }}
        >
          <Icons.Trash />
        </div>
      )}
      
      <div className={`rounded-xl p-3 ${isExpense ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
        {isExpense ? <Icons.TrendingDown /> : <Icons.TrendingUp />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-800">{transaction.kategoria}</p>
          {transaction.podkategoria && (
            <span className="text-sm text-gray-400">/ {transaction.podkategoria}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-gray-500">{formatDate(transaction.data)}</span>
          <span className="text-gray-300">•</span>
          <span className="text-sm text-gray-500">{transaction.osoba}</span>
          {transaction.komentarz && (
            <>
              <span className="text-gray-300">•</span>
              <span className="text-sm text-gray-400 truncate">{transaction.komentarz}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <p className={`text-lg font-semibold ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
          {isExpense ? '-' : '+'}{formatCurrency(transaction.kwota)}
        </p>
        <button
          onClick={() => onDelete(transaction.id)}
          className="md:opacity-0 md:group-hover:opacity-100 rounded-lg p-2 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all"
          title="Usuń"
        >
          <Icons.Trash />
        </button>
      </div>
    </div>
  );
};

// Główna aplikacja
export default function BudgetApp() {
  const [currentPeriod, setCurrentPeriod] = useState(getCurrentMonth());
  const [transakcje, setTransakcje] = useState([]);
  const [kategorie, setKategorie] = useState({ Wydatek: {}, Przychód: {} });
  const [osoby, setOsoby] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  
  // Klucz cache dla transakcji danego miesiąca
  const getCacheKey = (month, year) => `budzet_trans_${month}_${year}`;
  
  // Pobierz wszystkie dane
  const fetchData = useCallback(async (showLoadingSpinner = true) => {
    const cacheKey = getCacheKey(currentPeriod.month, currentPeriod.year);
    
    // 1. Najpierw pokaż dane z cache (natychmiast)
    const cachedKategorie = sessionStorage.getItem('budzet_kategorie');
    const cachedOsoby = sessionStorage.getItem('budzet_osoby');
    const cachedTransakcje = sessionStorage.getItem(cacheKey);
    
    const hasCache = cachedKategorie && cachedOsoby;
    
    if (hasCache) {
      setKategorie(JSON.parse(cachedKategorie));
      setOsoby(JSON.parse(cachedOsoby));
      if (cachedTransakcje) {
        setTransakcje(JSON.parse(cachedTransakcje));
      }
      setIsLoading(false);
      setIsRefreshing(true); // Pokaż subtelny wskaźnik odświeżania
    } else if (showLoadingSpinner) {
      setIsLoading(true);
    }
    
    setError(null);
    
    // 2. Pobierz świeże dane w tle
    try {
      const url = `${API_URL}?action=getAllData&miesiac=${currentPeriod.month}&rok=${currentPeriod.year}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Aktualizuj stan
      const noweTransakcje = Array.isArray(data.transakcje) ? data.transakcje : [];
      const noweKategorie = data.kategorie || { Wydatek: {}, Przychód: {} };
      const noweOsoby = Array.isArray(data.osoby) ? data.osoby : [];
      
      setTransakcje(noweTransakcje);
      setKategorie(noweKategorie);
      setOsoby(noweOsoby);
      
      // Zapisz do cache
      sessionStorage.setItem(cacheKey, JSON.stringify(noweTransakcje));
      sessionStorage.setItem('budzet_kategorie', JSON.stringify(noweKategorie));
      sessionStorage.setItem('budzet_osoby', JSON.stringify(noweOsoby));
      
    } catch (err) {
      // Pokaż błąd tylko jeśli nie mamy cache
      if (!hasCache) {
        setError('Nie udało się połączyć z arkuszem. Sprawdź połączenie i odśwież stronę.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPeriod]);
  
  // Ładuj dane przy starcie i zmianie miesiąca
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  

  
  // Dodawanie transakcji
  const handleAddTransaction = async (transakcja) => {
    setIsSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addTransakcja',
          transakcja
        })
      });
      const result = await res.json();
      
      if (result.success) {
        await fetchData();
        setShowForm(false);
      } else {
        setError('Nie udało się dodać transakcji');
      }
    } catch (err) {
      setError('Błąd podczas zapisywania');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Usuwanie transakcji
  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę transakcję?')) return;
    
    try {
      await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteTransakcja',
          id
        })
      });
      await fetchData();
    } catch (err) {
      setError('Błąd podczas usuwania');
      console.error(err);
    }
  };
  
  // Nawigacja miesięcy
  const changeMonth = (delta) => {
    setCurrentPeriod(prev => {
      let newMonth = prev.month + delta;
      let newYear = prev.year;
      
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      } else if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      
      return { month: newMonth, year: newYear };
    });
  };
  
  // Obliczenia
  const przychody = transakcje
    .filter(t => t.typ === 'Przychód')
    .reduce((sum, t) => sum + Number(t.kwota), 0);
  
  const wydatki = transakcje
    .filter(t => t.typ === 'Wydatek')
    .reduce((sum, t) => sum + Number(t.kwota), 0);
  
  const bilans = przychody - wydatki;
  
  // Sortowanie transakcji (najnowsze pierwsze)
  // Użyj parseDate aby prawidłowo sortować daty w formacie YYYY-MM-DD
  const sortedTransakcje = [...transakcje].sort((a, b) => 
    parseDate(b.data) - parseDate(a.data)
  );
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-lg bg-white/70 border-b border-gray-200/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 text-white shadow-lg">
                <Icons.Wallet />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Budżet Domowy</h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500">Kontroluj swoje finanse</p>
                  {isRefreshing && (
                    <span className="flex items-center gap-1 text-xs text-indigo-500">
                      <Icons.Loader /> Odświeżam...
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Nawigacja miesięcy */}
            <div className="flex items-center gap-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-1">
              <button 
                onClick={() => changeMonth(-1)}
                className="rounded-xl p-2 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Icons.ChevronLeft />
              </button>
              <span className="px-3 py-1 font-medium text-gray-700 min-w-[140px] text-center capitalize">
                {getMonthName(currentPeriod.month, currentPeriod.year)}
              </span>
              <button 
                onClick={() => changeMonth(1)}
                className="rounded-xl p-2 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Icons.ChevronRight />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Błąd */}
        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-rose-700">
            {error}
            <button 
              onClick={() => setError(null)} 
              className="ml-2 underline hover:no-underline"
            >
              Zamknij
            </button>
          </div>
        )}
        
        {/* Ładowanie */}
        {isLoading ? (
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
            
            {/* Lista transakcji */}
            <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800">
                  Transakcje ({transakcje.length})
                </h2>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all"
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
                      onClick={() => setShowForm(true)}
                      className="text-indigo-600 hover:underline font-medium"
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
          onSubmit={handleAddTransaction}
          onClose={() => setShowForm(false)}
          kategorie={kategorie}
          osoby={osoby}
          isLoading={isSaving}
        />
      )}
      
      {/* FAB dla mobile */}
      {!showForm && !isLoading && (
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