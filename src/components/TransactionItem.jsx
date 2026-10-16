import { formatCurrency } from '../utils/calculations';
import { formatDate } from '../utils/format';
import { Icons } from './Icons';

// Komponent pojedynczej transakcji.
// Edycja i usuwanie działają także offline — handlery w BudgetApp kolejkują
// operacje do synchronizacji po odzyskaniu połączenia.
export default function TransactionItem({ transaction, onDelete, onEdit }) {
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
              <span className="text-sm text-gray-500 truncate">/ {transaction.podkategoria}</span>
            )}
          </div>
          <div className="flex items-center gap-x-2 gap-y-0.5 mt-1 flex-wrap">
            <span className="text-sm text-gray-500 whitespace-nowrap">{formatDate(transaction.data)}</span>
            <span className="text-gray-300">•</span>
            <span className="text-sm text-gray-500 whitespace-nowrap">{transaction.osoba}</span>
            {transaction.komentarz && (
              <>
                <span className="text-gray-300 hidden sm:inline">•</span>
                <span className="text-sm text-gray-500 truncate max-w-[200px] sm:max-w-[150px] basis-full sm:basis-auto">{transaction.komentarz}</span>
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
            onClick={() => onEdit(transaction)}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 transition-[opacity,colors]"
            title="Edytuj"
            aria-label={`Edytuj transakcję ${transaction.kategoria} z ${formatDate(transaction.data)}`}
          >
            <Icons.Edit />
          </button>
          <button
            onClick={() => onDelete(transaction.id)}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-[opacity,colors]"
            title="Usuń"
            aria-label={`Usuń transakcję ${transaction.kategoria} z ${formatDate(transaction.data)}`}
          >
            <Icons.Trash />
          </button>
        </div>
      </div>
    </div>
  );
}
