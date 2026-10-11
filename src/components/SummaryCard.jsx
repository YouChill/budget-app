import { formatCurrency } from '../utils/calculations';

// Komponent karty podsumowania
export default function SummaryCard({ title, amount, icon, type }) {
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
}
