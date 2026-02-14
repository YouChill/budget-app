import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import * as api from '../services/api';
import {
  formatCurrency,
  MONTHS_PL_SHORT,
  aggregateByMonth,
  aggregateByCategory,
  aggregateByPerson,
  calculateYoY,
} from '../utils/calculations';

// ============================================
// COLOR PALETTE (reuse from CategoryCharts)
// ============================================
const CATEGORY_COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#ef4444', '#14b8a6',
  '#a855f7', '#f97316', '#3b82f6', '#eab308', '#22d3ee',
];

// ============================================
// INLINE SVG ICONS
// ============================================
const TrendUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const TrendDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
  </svg>
);
const WalletIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);
const PiggyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2" />
    <path d="M2 9.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0" />
  </svg>
);
const LoaderIcon = () => (
  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
const CalendarSearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

// ============================================
// CUSTOM TOOLTIPS
// ============================================
const MonthlyBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
      <p className="font-semibold text-gray-800 text-sm mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

const AreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
      <p className="font-semibold text-gray-800 text-sm">{label}</p>
      <p className="text-indigo-600 text-sm">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
      <p className="font-semibold text-gray-800 text-sm">{d.name}</p>
      <p className="text-gray-600 text-sm">{formatCurrency(d.value)}</p>
    </div>
  );
};

const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      className="text-xs font-semibold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

const CustomLegend = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2 px-2">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-gray-600 whitespace-nowrap">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================
// KPI CARD
// ============================================
const KpiCard = ({ title, amount, icon, gradient, yoy }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 sm:p-5 text-white shadow-lg`}>
    <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-white/10" />
    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-lg bg-white/20 p-1.5">{icon}</div>
        <span className="text-sm font-medium text-white/80">{title}</span>
      </div>
      <p className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{formatCurrency(amount)}</p>
      {yoy && yoy.percent !== null && (
        <p className="text-xs mt-1 text-white/70">
          {yoy.percent >= 0 ? '+' : ''}{yoy.percent.toFixed(1)}% r/r
          ({yoy.change >= 0 ? '+' : ''}{formatCurrency(yoy.change)})
        </p>
      )}
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
export default function YearlySummary({ year }) {
  const [yearData, setYearData] = useState([]);
  const [prevYearData, setPrevYearData] = useState([]);
  const [compareYear, setCompareYear] = useState(null);
  const [compareData, setCompareData] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);

  // Fetch year data
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setCompareYear(null);
    setCompareData([]);

    const load = async () => {
      try {
        const [data, prevData, years] = await Promise.all([
          api.getTransakcjeForYear(year),
          api.getTransakcjeForYear(year - 1).catch(() => []),
          api.getAvailableYears().catch(() => [year]),
        ]);
        if (cancelled) return;
        setYearData(data || []);
        setPrevYearData(prevData || []);
        setAvailableYears(years);
      } catch {
        if (!cancelled) {
          setYearData([]);
          setPrevYearData([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year]);

  // Fetch compare year data
  useEffect(() => {
    if (!compareYear) { setCompareData([]); return; }
    let cancelled = false;
    setIsLoadingCompare(true);
    api.getTransakcjeForYear(compareYear)
      .then(data => { if (!cancelled) setCompareData(data || []); })
      .catch(() => { if (!cancelled) setCompareData([]); })
      .finally(() => { if (!cancelled) setIsLoadingCompare(false); });
    return () => { cancelled = true; };
  }, [compareYear]);

  // ---- Computations ----
  const monthlyData = useMemo(() => aggregateByMonth(yearData), [yearData]);
  const prevMonthlyData = useMemo(() => aggregateByMonth(prevYearData), [prevYearData]);

  const totalIncome = useMemo(() => monthlyData.reduce((s, m) => s + m.przychody, 0), [monthlyData]);
  const totalExpenses = useMemo(() => monthlyData.reduce((s, m) => s + m.wydatki, 0), [monthlyData]);
  const totalBalance = totalIncome - totalExpenses;
  const avgMonthlyExpense = totalExpenses / 12;

  const prevTotalIncome = useMemo(() => prevMonthlyData.reduce((s, m) => s + m.przychody, 0), [prevMonthlyData]);
  const prevTotalExpenses = useMemo(() => prevMonthlyData.reduce((s, m) => s + m.wydatki, 0), [prevMonthlyData]);
  const prevTotalBalance = prevTotalIncome - prevTotalExpenses;

  const yoyIncome = useMemo(() => calculateYoY(totalIncome, prevTotalIncome), [totalIncome, prevTotalIncome]);
  const yoyExpenses = useMemo(() => calculateYoY(totalExpenses, prevTotalExpenses), [totalExpenses, prevTotalExpenses]);
  const yoyBalance = useMemo(() => calculateYoY(totalBalance, prevTotalBalance), [totalBalance, prevTotalBalance]);

  const cumulativeSavings = useMemo(() => {
    let cum = 0;
    return monthlyData.map(m => {
      cum += (m.przychody - m.wydatki);
      return { month: m.month, savings: Math.round(cum * 100) / 100 };
    });
  }, [monthlyData]);

  const categoryData = useMemo(() => aggregateByCategory(yearData, 'Wydatek'), [yearData]);
  const personData = useMemo(() => aggregateByPerson(yearData), [yearData]);

  // Compare tab computations
  const compareMonthlyData = useMemo(() => aggregateByMonth(compareData), [compareData]);
  const compareCategoryData = useMemo(() => aggregateByCategory(compareData, 'Wydatek'), [compareData]);
  const compareTotalIncome = useMemo(() => compareMonthlyData.reduce((s, m) => s + m.przychody, 0), [compareMonthlyData]);
  const compareTotalExpenses = useMemo(() => compareMonthlyData.reduce((s, m) => s + m.wydatki, 0), [compareMonthlyData]);

  const maxCategoryValue = categoryData.length > 0 ? categoryData[0].value : 1;

  // Compare tab — side by side monthly data
  const compareChartData = useMemo(() => {
    if (!compareYear) return [];
    return MONTHS_PL_SHORT.map((m, i) => ({
      month: m,
      [`Wydatki ${year}`]: monthlyData[i].wydatki,
      [`Wydatki ${compareYear}`]: compareMonthlyData[i].wydatki,
      [`Przychody ${year}`]: monthlyData[i].przychody,
      [`Przychody ${compareYear}`]: compareMonthlyData[i].przychody,
    }));
  }, [compareYear, year, monthlyData, compareMonthlyData]);

  // Compare tab — category comparison table
  const categoryCompareTable = useMemo(() => {
    if (!compareYear) return [];
    const map = new Map();
    categoryData.forEach(c => map.set(c.name, { base: c.value, compare: 0 }));
    compareCategoryData.forEach(c => {
      if (map.has(c.name)) map.get(c.name).compare = c.value;
      else map.set(c.name, { base: 0, compare: c.value });
    });
    return Array.from(map.entries())
      .map(([name, { base, compare }]) => ({ name, base, compare, change: base - compare }))
      .sort((a, b) => b.base - a.base);
  }, [compareYear, categoryData, compareCategoryData]);

  // Person data for pie chart
  const personPieData = useMemo(() =>
    personData.map(p => ({ name: p.name, value: p.wydatki })).filter(p => p.value > 0),
    [personData]
  );

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <LoaderIcon />
          <span>Ładowanie danych rocznych...</span>
        </div>
      </div>
    );
  }

  // ---- TABS ----
  const tabs = [
    { id: 'overview', label: 'Przegląd' },
    { id: 'compare', label: 'Porównanie lat' },
    { id: 'persons', label: 'Osoby' },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Przychody roczne" amount={totalIncome} icon={<TrendUpIcon />}
              gradient="from-emerald-500 to-teal-600" yoy={prevYearData.length > 0 ? yoyIncome : null} />
            <KpiCard title="Wydatki roczne" amount={totalExpenses} icon={<TrendDownIcon />}
              gradient="from-rose-500 to-red-600" yoy={prevYearData.length > 0 ? yoyExpenses : null} />
            <KpiCard title="Bilans roczny" amount={totalBalance} icon={<WalletIcon />}
              gradient="from-indigo-500 to-purple-600" yoy={prevYearData.length > 0 ? yoyBalance : null} />
            <KpiCard title="Śr. mies. wydatek" amount={avgMonthlyExpense} icon={<PiggyIcon />}
              gradient="from-amber-500 to-orange-600" yoy={null} />
          </div>

          {/* Monthly Income vs Expenses Bar Chart */}
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

          {/* Cumulative Savings Area Chart */}
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

          {/* Expenses by Category — Pie + Ranking */}
          <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Wydatki wg kategorii</h3>
            {categoryData.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Brak wydatków w tym roku</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Donut Chart */}
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
                {/* Category Ranking */}
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
      )}

      {/* ========== COMPARE TAB ========== */}
      {activeTab === 'compare' && (
        <div className="space-y-6">
          {/* Year Selector */}
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
            /* Empty state */
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
              {/* Change Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(() => {
                  const incChange = calculateYoY(totalIncome, compareTotalIncome);
                  return (
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
                  );
                })()}
                {(() => {
                  const expChange = calculateYoY(totalExpenses, compareTotalExpenses);
                  const isBetter = expChange.change <= 0;
                  return (
                    <div className="rounded-2xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-5">
                      <p className="text-sm text-gray-500 mb-1">Zmiana wydatków</p>
                      <p className={`text-2xl font-bold ${isBetter ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {expChange.change >= 0 ? '+' : ''}{formatCurrency(expChange.change)}
                      </p>
                      {expChange.percent !== null && (
                        <p className={`text-sm ${isBetter ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {expChange.percent >= 0 ? '+' : ''}{expChange.percent.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Side-by-side Expenses Chart */}
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

              {/* Side-by-side Income Chart */}
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

              {/* Category Comparison Table */}
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
      )}

      {/* ========== PERSONS TAB ========== */}
      {activeTab === 'persons' && (
        <div className="space-y-6">
          {personData.length === 0 ? (
            <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-12 text-center">
              <div className="text-gray-300 flex justify-center mb-4"><UserIcon /></div>
              <p className="text-gray-500 text-sm">Brak danych o osobach w tym roku</p>
            </div>
          ) : (
            <>
              {/* Person Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {personData.map(person => {
                  const maxVal = Math.max(person.przychody, person.wydatki, 1);
                  return (
                    <div key={person.name} className="rounded-2xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{person.name}</p>
                          <p className={`text-sm font-medium ${person.bilans >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            Bilans: {formatCurrency(person.bilans)}
                          </p>
                        </div>
                      </div>
                      {/* Income bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Przychody</span>
                          <span className="font-medium text-emerald-600">{formatCurrency(person.przychody)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(person.przychody / maxVal) * 100}%` }} />
                        </div>
                      </div>
                      {/* Expense bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Wydatki</span>
                          <span className="font-medium text-rose-600">{formatCurrency(person.wydatki)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="h-2 rounded-full bg-rose-400" style={{ width: `${(person.wydatki / maxVal) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Expense share pie chart */}
              {personPieData.length > 0 && (
                <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Udział w wydatkach</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={personPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={110}
                        paddingAngle={2} dataKey="value" labelLine={false} label={renderPieLabel}>
                        {personPieData.map((_, i) => (
                          <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} stroke="white" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend content={<CustomLegend />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
