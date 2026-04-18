import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCurrency, calculateYoY } from '../../utils/calculations';
import {
  CalendarSearchIcon, LoaderIcon, MonthlyBarTooltip,
} from './primitives';

export default function CompareTab({
  year,
  availableYears,
  compareYear,
  setCompareYear,
  isLoadingCompare,
  totalIncome,
  totalExpenses,
  compareTotalIncome,
  compareTotalExpenses,
  compareChartData,
  categoryCompareTable,
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Porównaj z rokiem</h3>
        <div className="flex flex-wrap gap-2">
          {availableYears.filter(y => y !== year).map(y => (
            <button
              key={y}
              onClick={() => setCompareYear(y === compareYear ? null : y)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                compareYear === y
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {!compareYear ? (
        <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-12 text-center">
          <div className="text-gray-300 flex justify-center mb-4"><CalendarSearchIcon /></div>
          <p className="text-gray-500 text-sm">Wybierz rok do porównania</p>
        </div>
      ) : isLoadingCompare ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-gray-500">
            <LoaderIcon />
            <span>Ładowanie danych porównawczych...</span>
          </div>
        </div>
      ) : (
        <>
          <ChangeCards
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            compareTotalIncome={compareTotalIncome}
            compareTotalExpenses={compareTotalExpenses}
          />

          <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Wydatki — porównanie miesięczne</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={compareChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={45} />
                <Tooltip content={<MonthlyBarTooltip />} />
                <Bar dataKey={`Wydatki ${year}`} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey={`Wydatki ${compareYear}`} fill="#fda4af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Przychody — porównanie miesięczne</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={compareChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={45} />
                <Tooltip content={<MonthlyBarTooltip />} />
                <Bar dataKey={`Przychody ${year}`} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey={`Przychody ${compareYear}`} fill="#6ee7b7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">Wydatki wg kategorii — porównanie</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="text-left px-6 py-3 font-medium text-gray-500">Kategoria</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">{year}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">{compareYear}</th>
                    <th className="text-right px-6 py-3 font-medium text-gray-500">Zmiana</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryCompareTable.map(row => (
                    <tr key={row.name} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-6 py-3 font-medium text-gray-700">{row.name}</td>
                      <td className="px-4 py-3 text-right text-gray-800">{formatCurrency(row.base)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(row.compare)}</td>
                      <td className={`px-6 py-3 text-right font-medium ${row.change <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {row.change >= 0 ? '+' : ''}{formatCurrency(row.change)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChangeCards({ totalIncome, totalExpenses, compareTotalIncome, compareTotalExpenses }) {
  const incChange = calculateYoY(totalIncome, compareTotalIncome);
  const expChange = calculateYoY(totalExpenses, compareTotalExpenses);
  const isBetterExpense = expChange.change <= 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-2xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-5">
        <p className="text-sm text-gray-500 mb-1">Zmiana przychodów</p>
        <p className={`text-2xl font-bold ${incChange.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {incChange.change >= 0 ? '+' : ''}{formatCurrency(incChange.change)}
        </p>
        {incChange.percent !== null && (
          <p className={`text-sm ${incChange.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {incChange.percent >= 0 ? '+' : ''}{incChange.percent.toFixed(1)}%
          </p>
        )}
      </div>
      <div className="rounded-2xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-5">
        <p className="text-sm text-gray-500 mb-1">Zmiana wydatków</p>
        <p className={`text-2xl font-bold ${isBetterExpense ? 'text-emerald-600' : 'text-rose-600'}`}>
          {expChange.change >= 0 ? '+' : ''}{formatCurrency(expChange.change)}
        </p>
        {expChange.percent !== null && (
          <p className={`text-sm ${isBetterExpense ? 'text-emerald-500' : 'text-rose-500'}`}>
            {expChange.percent >= 0 ? '+' : ''}{expChange.percent.toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}
