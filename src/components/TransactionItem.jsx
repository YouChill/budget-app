import React from 'react';

/**
 * Komponent wyświetlający pojedynczą transakcję
 * @param {Object} transaction - Dane transakcji
 * @param {string} transaction.id - ID transakcji
 * @param {string} transaction.data - Data transakcji (format ISO)
 * @param {string} transaction.typ - Typ transakcji ("Wydatek" lub "Przychód")
 * @param {number} transaction.kwota - Kwota transakcji
 * @param {string} transaction.kategoria - Kategoria
 * @param {string} [transaction.podkategoria] - Podkategoria (opcjonalne)
 * @param {string} transaction.osoba - Osoba odpowiedzialna
 * @param {string} [transaction.komentarz] - Komentarz (opcjonalne)
 * @param {Function} onDelete - Callback po kliknięciu usuwania
 * @param {Function} [onEdit] - Callback po kliknięciu edycji
 */
export default function TransactionItem({ 
  transaction, 
  onDelete, 
  onEdit = null 
}) {
  const { id, data, typ, kwota, kategoria, podkategoria, osoba, komentarz } = transaction;
  
  const isExpense = typ === 'Wydatek';
  const isIncome = typ === 'Przychód';

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const colorClass = isExpense ? 'text-rose-600' : 'text-emerald-600';
  const signSymbol = isExpense ? '-' : '+';
  const bgColorClass = isExpense 
    ? 'bg-rose-50 hover:bg-rose-100' 
    : 'bg-emerald-50 hover:bg-emerald-100';

  return (
    <div 
      className={`p-4 rounded-lg ${bgColorClass} transition-colors cursor-pointer border border-gray-100`}
      data-testid={`transaction-${id}`}
      data-transaction-type={typ}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-800 truncate">
              {kategoria}
              {podkategoria && <span className="text-gray-600 text-sm"> / {podkategoria}</span>}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{osoba}</span>
            <span>•</span>
            <span>{formatDate(data)}</span>
          </div>
          {komentarz && (
            <p className="text-sm text-gray-600 mt-1 truncate">{komentarz}</p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <div className={`text-right min-w-max ${colorClass} font-semibold`}>
            <div>{signSymbol} {formatCurrency(kwota)}</div>
          </div>
          
          <div className="flex items-center gap-1 ml-2">
            {onEdit && (
              <button
                onClick={() => onEdit(id)}
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                title="Edytuj"
                data-testid={`edit-${id}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                </svg>
              </button>
            )}
            <button
              onClick={() => onDelete(id)}
              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
              title="Usuń"
              data-testid={`delete-${id}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
