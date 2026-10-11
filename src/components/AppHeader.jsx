import { getMonthName } from '../utils/calculations';
import { Icons } from './Icons';

// Nagłówek: logo, akcje (import CSV, budżety, ustawienia — niedostępne offline),
// użytkownik/wylogowanie, przełącznik Miesiąc/Rok i nawigacja okresu.
export default function AppHeader({
  user,
  onLogout,
  isOffline,
  onOpenImport,
  onOpenBudgets,
  onOpenSettings,
  activeView,
  setActiveView,
  currentPeriod,
  isCurrentMonth,
  onChangeMonth,
  onCurrentMonth,
  selectedYear,
  setSelectedYear,
  currentYear,
  minYear,
  maxYear,
}) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-lg bg-white/70 border-b border-gray-200/50">
      <div className="max-w-4xl mx-auto px-3 py-2 sm:px-4 sm:py-4">
        {/* Top row: logo/title + action buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Logo */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2 sm:p-2.5 text-white shadow-lg flex items-center justify-center">
              <Icons.Wallet />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-800 truncate">Budżet Domowy</h1>
              <p className="text-sm text-gray-500 hidden sm:block">Kontroluj swoje finanse</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Przycisk importu CSV */}
            <button
              onClick={() => !isOffline && onOpenImport()}
              className={`rounded-xl p-2 sm:p-2.5 transition-all ${isOffline ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-indigo-600'}`}
              title={isOffline ? 'Niedostępne offline' : 'Import z CSV'}
              aria-label={isOffline ? 'Import z CSV — niedostępne offline' : 'Import z CSV'}
              disabled={isOffline}
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>

            {/* Przycisk budżetów */}
            <button
              onClick={() => !isOffline && onOpenBudgets()}
              className={`rounded-xl p-2 sm:p-2.5 transition-all ${isOffline ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-indigo-600'}`}
              title={isOffline ? 'Niedostępne offline' : 'Budżety'}
              aria-label={isOffline ? 'Budżety — niedostępne offline' : 'Budżety'}
              disabled={isOffline}
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10v6a2 2 0 0 1-2 2H7"/><path d="M3 6h18"/><path d="M8 6v12"/></svg>
            </button>

            {/* Przycisk ustawień */}
            <button
              onClick={() => !isOffline && onOpenSettings()}
              className={`rounded-xl p-2 sm:p-2.5 transition-all ${isOffline ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-indigo-600'}`}
              title={isOffline ? 'Niedostępne offline' : 'Ustawienia'}
              aria-label={isOffline ? 'Ustawienia — niedostępne offline' : 'Ustawienia'}
              disabled={isOffline}
            >
              <Icons.Settings />
            </button>

            {/* User info & logout */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-white rounded-2xl shadow-sm border border-gray-100 px-2 py-1 sm:px-3 sm:py-1.5">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Icons.User />
              </div>
              <span className="text-sm text-gray-600 hidden sm:inline max-w-[120px] truncate" title={user?.email}>
                {user?.name || user?.email}
              </span>
              <button
                onClick={onLogout}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all"
                title="Wyloguj się"
                aria-label="Wyloguj się"
              >
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation - view switch + monthly or yearly period */}
        <div className="flex justify-center items-center gap-2 mt-2 sm:mt-2 flex-wrap">
          {/* Jawny przełącznik widoku Miesiąc/Rok */}
          <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1" role="group" aria-label="Widok danych">
            <button
              onClick={() => setActiveView('monthly')}
              aria-pressed={activeView === 'monthly'}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                activeView === 'monthly'
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Miesiąc
            </button>
            <button
              onClick={() => setActiveView('yearly')}
              aria-pressed={activeView === 'yearly'}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                activeView === 'yearly'
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Rok
            </button>
          </div>

          {/* Nawigacja okresu — identyczna, stała struktura w obu widokach
              (‹ | etykieta | ›), żeby przełączanie Miesiąc/Rok nie
              przesuwało układu. Etykieta okresu jest przyciskiem
              „wróć do dziś" — bez osobnego przycisku zajmującego miejsce. */}
          {activeView === 'monthly' ? (
            <div className="flex items-center gap-1 sm:gap-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-1">
              <button
                onClick={() => onChangeMonth(-1)}
                aria-label="Poprzedni miesiąc"
                className="rounded-xl p-2.5 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Icons.ChevronLeft />
              </button>
              <button
                onClick={onCurrentMonth}
                disabled={isCurrentMonth}
                title={isCurrentMonth ? undefined : 'Wróć do bieżącego miesiąca'}
                aria-label={isCurrentMonth ? undefined : `${getMonthName(currentPeriod.month, currentPeriod.year)} — wróć do bieżącego miesiąca`}
                className="rounded-xl px-2 sm:px-3 py-1 text-sm font-medium text-gray-700 min-w-[130px] sm:min-w-[140px] text-center capitalize hover:bg-gray-100 disabled:hover:bg-transparent transition-colors"
                aria-live="polite"
              >
                {getMonthName(currentPeriod.month, currentPeriod.year)}
              </button>
              <button
                onClick={() => onChangeMonth(1)}
                aria-label="Następny miesiąc"
                className="rounded-xl p-2.5 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Icons.ChevronRight />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-1">
              <button
                onClick={() => setSelectedYear(y => Math.max(minYear, y - 1))}
                disabled={selectedYear <= minYear}
                aria-label="Poprzedni rok"
                className="rounded-xl p-2.5 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Icons.ChevronLeft />
              </button>
              <button
                onClick={() => setSelectedYear(currentYear)}
                disabled={selectedYear === currentYear}
                title={selectedYear === currentYear ? undefined : 'Wróć do bieżącego roku'}
                aria-label={selectedYear === currentYear ? undefined : `${selectedYear} — wróć do bieżącego roku`}
                className="rounded-xl px-2 sm:px-3 py-1 text-sm font-medium text-gray-700 min-w-[130px] sm:min-w-[140px] text-center hover:bg-gray-100 disabled:hover:bg-transparent transition-colors"
                aria-live="polite"
              >
                {selectedYear}
              </button>
              <button
                onClick={() => setSelectedYear(y => Math.min(maxYear, y + 1))}
                disabled={selectedYear >= maxYear}
                aria-label="Następny rok"
                className="rounded-xl p-2.5 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Icons.ChevronRight />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
