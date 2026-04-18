import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { formatCurrency } from '../../utils/calculations';
import {
  CATEGORY_COLORS,
  TrendUpIcon, TrendDownIcon, WalletIcon, PiggyIcon,
  MonthlyBarTooltip, AreaTooltip, PieTooltip, renderPieLabel, CustomLegend, KpiCard,
} from './primitives';

export default function OverviewTab({
  prevYearData,
  monthlyData,
  totalIncome,
  totalExpenses,
  totalBalance,
  avgMonthlyExpense,
  cumulativeSavings,
  categoryData,
  maxCategoryValue,
  yoyIncome,
  yoyExpenses,
  yoyBalance,
}) {
  const hasPrev = prevYearData.length > 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Przychody roczne" amount={totalIncome} icon={<TrendUpIcon />}
          gradient="from-emerald-500 to-teal-600" yoy={hasPrev ? yoyIncome : null} />
        <KpiCard title="Wydatki roczne" amount={totalExpenses} icon={<TrendDownIcon />}
          gradient="from-rose-500 to-red-600" yoy={hasPrev ? yoyExpenses : null} />
        <KpiCard title="Bilans roczny" amount={totalBalance} icon={<WalletIcon />}
          gradient="from-indigo-500 to-purple-600" yoy={hasPrev ? yoyBalance : null} />
        <KpiCard title="Śr. mies. wydatek" amount={avgMonthlyExpense} icon={<PiggyIcon />}
          gradient="from-amber-500 to-orange-600" yoy={null} />
      </div>

      <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Przychody vs Wydatki</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={45} />
            <Tooltip content={<MonthlyBarTooltip />} />
            <Bar dataKey="przychody" name="Przychody" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="wydatki" name="Wydatki" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Oszczędności skumulowane</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={cumulativeSavings} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={45} />
            <Tooltip content={<AreaTooltip />} />
            <Area type="monotone" dataKey="savings" name="Oszczędności" stroke="#6366f1" strokeWidth={2}
              fill="url(#savingsGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Wydatki wg kategorii</h3>
        {categoryData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Brak wydatków w tym roku</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={110}
                    paddingAngle={2} dataKey="value" labelLine={false} label={renderPieLabel}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend content={<CustomLegend />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              {categoryData.map((cat, i) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 font-medium truncate">{cat.name}</span>
                      <span className="text-sm font-semibold text-gray-800 ml-2 whitespace-nowrap">{formatCurrency(cat.value)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full transition-all"
                        style={{
                          width: `${(cat.value / maxCategoryValue) * 100}%`,
                          backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                        }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
