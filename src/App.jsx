import { useState, useMemo, lazy, Suspense } from 'react';
import LoginPage from './components/LoginPage';
import ConfirmDialog from './components/ConfirmDialog';
import OfflineBanner from './components/OfflineBanner';
import AppHeader from './components/AppHeader';
import SummaryCard from './components/SummaryCard';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import SettingsPanel from './components/settings/SettingsPanel';
import { Icons } from './components/Icons';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { useOffline } from './hooks/useOffline';
import { useBudgets } from './hooks/useBudgets';
import { useAvailableYears } from './hooks/useAvailableYears';
import { usePendingOperations } from './hooks/usePendingOperations';
import { useMonthlyData } from './hooks/useMonthlyData';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useTransactionActions } from './hooks/useTransactionActions';
import { useTransactionFilters } from './hooks/useTransactionFilters';
import {
  getCurrentMonth,
  calculateIncome,
  calculateExpenses,
  roundTo2,
  changeMonth as computeMonthChange,
} from './utils/calculations';

// Ciężkie widoki (recharts, papaparse, parsery bankowe) w osobnych chunkach —
// ekran logowania i lista transakcji ładują się bez nich. Service worker
// precache'uje wszystkie chunki, więc działają też offline.
const CategoryCharts = lazy(() => import('./components/CategoryCharts'));
const Budgets = lazy(() => import('./components/Budgets'));
const CSVImport = lazy(() => import('./components/CSVImport'));
const YearlySummary = lazy(() => import('./components/YearlySummary'));

// ============================================
// GŁÓWNA APLIKACJA
// ============================================
export default function BudgetApp() {
  const { user, isAuthenticated, isLoading: authLoading, isRecoveringPassword, logout } = useAuth();
  const { addToast } = useToast();
  const { isOffline } = useOffline();

  const [currentPeriod, setCurrentPeriod] = useState(getCurrentMonth());
  const [showBudgets, setShowBudgets] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Dane miesiąca — transakcje, kategorie, osoby + fetch z isLoading/error.
  // Setery zwracane do optymistycznych aktualizacji i callbacków ustawień.
  const {
    transakcje,
    kategorie,
    osoby,
    isLoading,
    error,
    setTransakcje,
    setKategorie,
    setOsoby,
    setError,
    refresh: fetchData,
  } = useMonthlyData({
    month: currentPeriod.month,
    year: currentPeriod.year,
    // Bez tej bramki fetch odpala się przed zalogowaniem, pada na braku
    // sesji i nigdy nie jest ponawiany — po zalogowaniu bez przeładowania
    // strony formularz transakcji zostawał bez kategorii.
    enabled: isAuthenticated && !isRecoveringPassword,
  });

  // Yearly summary view state
  const [activeView, setActiveView] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Budżety dla bieżącego okresu — własny hook, niezależny od fetchData
  const { budgets, refresh: refreshBudgets } = useBudgets({
    month: currentPeriod.month,
    year: currentPeriod.year,
    enabled: isAuthenticated && !isRecoveringPassword && !isOffline,
  });

  const availableYears = useAvailableYears({ enabled: isAuthenticated && !isRecoveringPassword && !isOffline });

  // Offline queue: licznik + auto-sync przy powrocie online
  const { pendingCount, isSyncing, refreshPendingCount } = usePendingOperations({
    isOffline,
    userId: user?.id,
    onSynced: () => fetchData(false),
    addToast,
  });

  // Real-time: zmiany z innych urządzeń/domowników odświeżają bieżący miesiąc
  useRealtimeSync({ user, isOffline, onChange: () => fetchData(false) });

  const { isSaving, addTransaction, editTransaction, deleteTransaction } = useTransactionActions({
    isOffline,
    userId: user?.id,
    transakcje,
    setTransakcje,
    refresh: fetchData,
    refreshPendingCount,
    addToast,
  });

  const filters = useTransactionFilters(transakcje);
  const { selectedCategory, toggleCategory, clearFilters } = filters;

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

  const handleSubmitForm = async (transakcja) => {
    const ok = editingTransaction
      ? await editTransaction(editingTransaction.id, transakcja)
      : await addTransaction(transakcja);
    if (ok) handleCloseForm();
  };

  // Nawigacja miesięcy — czyści wyszukiwanie, żeby filtr z poprzedniego
  // miesiąca nie ukrywał danych nowego.
  const changeMonth = (delta) => {
    setCurrentPeriod(prev => computeMonthChange(prev.month, prev.year, delta));
    clearFilters();
  };

  const goToCurrentMonth = () => {
    setCurrentPeriod(getCurrentMonth());
    clearFilters();
  };

  // Obliczenia — memoizowane, korzystają z pure helperów z utils/calculations.
  const przychody = useMemo(() => calculateIncome(transakcje), [transakcje]);
  const wydatki = useMemo(() => calculateExpenses(transakcje), [transakcje]);
  const bilans = roundTo2(przychody - wydatki);

  // Stan nawigacji okresu — wspólny dla widoku miesięcznego i rocznego
  const isCurrentMonth =
    currentPeriod.month === getCurrentMonth().month &&
    currentPeriod.year === getCurrentMonth().year;
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(...availableYears);
  const maxYear = Math.max(...availableYears);

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

  if (!isAuthenticated || isRecoveringPassword) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50">
      {/* Offline banner */}
      <OfflineBanner isOffline={isOffline} pendingCount={pendingCount} isSyncing={isSyncing} />

      <AppHeader
        user={user}
        onLogout={logout}
        isOffline={isOffline}
        onOpenImport={() => setShowCSVImport(true)}
        onOpenBudgets={() => setShowBudgets(true)}
        onOpenSettings={() => setShowSettings(true)}
        activeView={activeView}
        setActiveView={setActiveView}
        currentPeriod={currentPeriod}
        isCurrentMonth={isCurrentMonth}
        onChangeMonth={changeMonth}
        onCurrentMonth={goToCurrentMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        currentYear={currentYear}
        minYear={minYear}
        maxYear={maxYear}
      />

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
          <Suspense fallback={<div className="py-20 text-center text-gray-400">Ładowanie…</div>}>
            <YearlySummary year={selectedYear} />
          </Suspense>
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
            <Suspense fallback={<div className="h-72 rounded-3xl bg-white/50 border border-gray-100 animate-pulse" />}>
              <CategoryCharts
                transakcje={transakcje}
                budgets={budgets}
                currentPeriod={currentPeriod}
                selectedCategory={selectedCategory}
                onSelectCategory={toggleCategory}
              />
            </Suspense>

            <TransactionList
              totalCount={transakcje.length}
              {...filters}
              onAdd={() => setShowForm(true)}
              onEdit={handleOpenEdit}
              onDelete={setConfirmDeleteId}
            />
          </>
        )}
      </main>

      {/* Formularz */}
      {showForm && (
        <TransactionForm
          onSubmit={handleSubmitForm}
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
          onKategorieChange={setKategorie}
          onOsobyChange={setOsoby}
        />
      )}

      <Suspense fallback={null}>
      {showBudgets && (
        <Budgets
          onClose={() => setShowBudgets(false)}
          kategorie={kategorie}
          month={currentPeriod.month}
          year={currentPeriod.year}
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
      </Suspense>

      {/* Potwierdzenie usunięcia transakcji */}
      {confirmDeleteId !== null && (
        <ConfirmDialog
          title="Usunąć transakcję?"
          message="Tej operacji nie można cofnąć."
          onConfirm={() => {
            const id = confirmDeleteId;
            setConfirmDeleteId(null);
            deleteTransaction(id);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* FAB dla mobile */}
      {!showForm && !isLoading && activeView === 'monthly' && (
        <button
          onClick={() => setShowForm(true)}
          aria-label="Dodaj transakcję"
          className="fixed bottom-6 right-6 md:hidden rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white shadow-2xl shadow-indigo-400 hover:scale-110 transition-transform"
        >
          <Icons.Plus />
        </button>
      )}
    </div>
  );
}
