import { formatCurrency } from '../utils/calculations';
import { formatDayHeader } from '../utils/format';
import { Icons } from './Icons';
import TransactionItem from './TransactionItem';

// Karta listy transakcji: nagłówek z licznikiem, chip filtra kategorii,
// wyszukiwarka i lista pogrupowana po dniach (stan filtrów: useTransactionFilters).
export default function TransactionList({
  totalCount,
  sortedTransakcje,
  filteredTransakcje,
  groupedByDay,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  clearFilters,
  onAdd,
  onEdit,
  onDelete,
}) {
  return (
    <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">
          Transakcje ({(searchQuery || selectedCategory) ? `${filteredTransakcje.length} z ${totalCount}` : totalCount})
        </h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all"
        >
          <Icons.Plus />
          Dodaj
        </button>
      </div>

      {/* Chip aktywnego filtra kategorii */}
      {selectedCategory && (
        <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-gray-100">
          <span className="text-xs text-gray-500">Filtr:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 text-indigo-700 pl-3 pr-1.5 py-1 text-xs font-medium">
            {selectedCategory}
            <button
              onClick={() => setSelectedCategory(null)}
              aria-label={`Wyczyść filtr kategorii ${selectedCategory}`}
              className="rounded-full p-0.5 hover:bg-indigo-200 transition-colors"
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </span>
        </div>
      )}

      {/* Wyszukiwarka */}
      {sortedTransakcje.length > 0 && (
        <div className="px-4 sm:px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <svg aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Szukaj po kategorii, osobie, komentarzu…"
              aria-label="Szukaj transakcji"
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
        </div>
      )}

      <div className="p-4 space-y-5">
        {sortedTransakcje.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-2">Brak transakcji w tym miesiącu</p>
            <button
              onClick={onAdd}
              className="text-indigo-600 hover:underline font-medium"
            >
              Dodaj pierwszą transakcję
            </button>
          </div>
        ) : filteredTransakcje.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-2">
              {selectedCategory && searchQuery.trim()
                ? <>Brak transakcji w kategorii „{selectedCategory}" pasujących do „{searchQuery}"</>
                : selectedCategory
                  ? <>Brak transakcji w kategorii „{selectedCategory}"</>
                  : <>Brak transakcji pasujących do „{searchQuery}"</>}
            </p>
            <button
              onClick={clearFilters}
              className="text-indigo-600 hover:underline font-medium"
            >
              {selectedCategory && searchQuery.trim()
                ? 'Wyczyść filtry'
                : selectedCategory
                  ? 'Wyczyść filtr'
                  : 'Wyczyść wyszukiwanie'}
            </button>
          </div>
        ) : (
          groupedByDay.map(group => (
            <div key={group.key}>
              <div className="flex items-baseline justify-between px-1 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {formatDayHeader(group.key)}
                </h3>
                <span className={`text-xs font-semibold whitespace-nowrap ${group.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {group.net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(group.net))}
                </span>
              </div>
              <div className="space-y-3">
                {group.items.map(transaction => (
                  <TransactionItem
                    key={transaction.id}
                    transaction={transaction}
                    onDelete={onDelete}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
