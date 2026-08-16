import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

// ============================================
// PALETA KOLORÓW DLA KATEGORII
// ============================================
const CATEGORY_COLORS = [
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#ef4444', // red
  '#14b8a6', // teal
  '#a855f7', // purple
  '#f97316', // orange
  '#3b82f6', // blue
  '#eab308', // yellow
  '#22d3ee', // sky
];

// ============================================
// FORMATOWANIE WALUTY (reuse z App.jsx)
// ============================================
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// ============================================
// CUSTOM TOOLTIPS
// ============================================
const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
        <p className="font-semibold text-gray-800 text-sm">{data.name}</p>
        <p className="text-gray-600 text-sm">{formatCurrency(data.value)}</p>
        <p className="text-gray-400 text-xs">
          {(data.payload.percent * 100).toFixed(1)}% wydatków
        </p>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
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
  }
  return null;
};

// ============================================
// CUSTOM LEGEND
// ============================================
const CustomLegend = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2 px-2">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-gray-600 whitespace-nowrap">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ============================================
// CUSTOM PIE LABEL (procenty wewnątrz)
// ============================================
const renderCustomLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}) => {
  if (percent < 0.05) return null; // nie pokazuj < 5%
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x} y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-semibold"
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
    >
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

// ============================================
// IKONA WYKRESU (SVG inline, brak zależności)
// ============================================
const ChartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20" height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
    <path d="M22 12A10 10 0 0 0 12 2v10z" />
  </svg>
);

// ============================================
// GŁÓWNY KOMPONENT: CategoryCharts
// ============================================
// Props:
//   transakcje — tablica transakcji z bieżącego miesiąca
//                (ta sama co w BudgetApp state)
//   selectedCategory — aktywny filtr kategorii (string | null);
//                      służy tylko do podświetlenia, nie zmienia danych
//   onSelectCategory — callback kliknięcia kategorii (wykres/lista)
//
// Komponent sam filtruje Wydatki i grupuje po kategoriach.
// Nie wykonuje żadnych zapytań API.
// ============================================
export default function CategoryCharts({
  transakcje = [],
  budgets = [],
  currentPeriod = null,
  selectedCategory = null,
  onSelectCategory,
}) {
  const [activeView, setActiveView] = useState('pie');

  const handleClick = (name) => {
    if (onSelectCategory && name) onSelectCategory(name);
  };
  const dimmed = (name) =>
    selectedCategory && name !== selectedCategory ? 0.35 : 1;

  // ---- Dane do wykresu kołowego ----
  const pieData = useMemo(() => {
    const wydatki = transakcje.filter((t) => t.typ === 'Wydatek');
    const grouped = {};

    wydatki.forEach((t) => {
      const kat = t.kategoria || 'Inne';
      const v = Math.abs(Number(t.kwota));
      if (!Number.isFinite(v)) return; // pomiń puste/niepoprawne kwoty
      grouped[kat] = (grouped[kat] || 0) + v;
    });

    const total = Object.values(grouped).reduce((s, v) => s + v, 0);

    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100,
        percent: total > 0 ? value / total : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transakcje]);

  // ---- Dane do wykresu słupkowego (top 8) ----
  const barData = useMemo(() => {
    return pieData.slice(0, 8).map((item, idx) => ({
      name: item.name.length > 12 ? item.name.slice(0, 11) + '…' : item.name,
      fullName: item.name,
      kwota: item.value,
      fill: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }));
  }, [pieData]);

  const totalWydatki = pieData.reduce((s, d) => s + d.value, 0);

  // Mapa budżetów per kategoria (zbudowana raz) — unika skanowania O(N·M)
  // przy każdym renderze listy. Budżety z hooka useBudgets są już zawężone do
  // bieżącego okresu, więc dopuszczamy też roczne (miesiac = null).
  const budgetByCategory = useMemo(() => {
    const map = new Map();
    (budgets || []).forEach((b) => {
      if (currentPeriod && b.zakres !== 'yearly' && b.miesiac != null) {
        if (Number(b.miesiac) !== Number(currentPeriod.month) ||
            Number(b.rok) !== Number(currentPeriod.year)) {
          return;
        }
      }
      if (!map.has(b.kategoria)) map.set(b.kategoria, b);
    });
    return map;
  }, [budgets, currentPeriod]);

  // ---- Stan pusty ----
  if (pieData.length === 0) {
    return (
      <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Wydatki wg kategorii
        </h2>
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <ChartIcon />
          <p className="mt-3 text-sm">Brak wydatków w tym miesiącu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm overflow-hidden">
      {/* ---- Header z przełącznikiem widoku ---- */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Wydatki wg kategorii
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Łącznie: {formatCurrency(totalWydatki)} w {pieData.length}{' '}
            {pieData.length === 1 ? 'kategorii' : 'kategoriach'}
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveView('pie')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeView === 'pie'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Kołowy
          </button>
          <button
            onClick={() => setActiveView('bar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeView === 'bar'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Słupkowy
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeView === 'pie' ? (
          /* ============ WYKRES KOŁOWY (donut) ============ */
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                  animationBegin={0}
                  animationDuration={800}
                  cursor="pointer"
                  onClick={(data) => handleClick(data?.name ?? data?.payload?.name)}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      fillOpacity={dimmed(entry.name)}
                      stroke="white"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* ============ WYKRES SŁUPKOWY ============ */
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={barData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  `${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`
                }
                width={45}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar
                dataKey="kwota"
                name="Wydatki"
                radius={[8, 8, 0, 0]}
                animationDuration={800}
                cursor="pointer"
                onClick={(data) => handleClick(data?.fullName ?? data?.payload?.fullName)}
              >
                {barData.map((entry, index) => (
                  <Cell
                    key={`bar-${index}`}
                    fill={entry.fill}
                    fillOpacity={dimmed(entry.fullName)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* ---- Szczegółowa lista kategorii ---- */}
        <div className="mt-6 space-y-2">
          {pieData.map((item, index) => {
            const budgetForCat = budgetByCategory.get(item.name);
            const rawLimit = budgetForCat ? Number(budgetForCat.limit) : null;
            // Tylko dodatni limit pozwala policzyć sensowny procent (chroni
            // przed dzieleniem przez 0 / NaN / Infinity).
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : null;
            const ratio = limit !== null ? item.value / limit : null;
            const percent = ratio !== null ? Math.min(ratio, 1) : null;
            const zrodlo = budgetForCat ? budgetForCat.zrodlo : null;
            const rocznyLimit = budgetForCat ? budgetForCat.rocznyLimit : null;
            let barColor = 'bg-emerald-400';
            if (percent !== null) {
              if (percent >= 1) barColor = 'bg-rose-500';
              else if (percent >= 0.8) barColor = 'bg-amber-400';
            }

            const isSelected = selectedCategory === item.name;
            const rowStateClasses = isSelected
              ? 'bg-indigo-50 ring-1 ring-indigo-200'
              : selectedCategory
                ? 'bg-white/80 opacity-50 hover:opacity-80'
                : 'bg-white/80 hover:bg-white';

            return (
              <div
                key={item.name}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => handleClick(item.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick(item.name);
                  }
                }}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${rowStateClasses}`}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 font-medium">{item.name}</span>
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(item.value)}</span>
                  </div>
                  {limit !== null && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className={`${barColor} h-2`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                        <div className="flex items-center gap-1.5">
                          <span>{Math.round(ratio * 100)}% z {formatCurrency(limit)}</span>
                          {zrodlo === 'monthly' && rocznyLimit !== null && (
                            <span className="text-amber-600">(nadpisany, roczny: {formatCurrency(rocznyLimit)})</span>
                          )}
                          {zrodlo === 'yearly' && (
                            <span className="text-purple-500">(roczny)</span>
                          )}
                        </div>
                        {ratio >= 1 ? (
                          <span className="text-rose-600 font-semibold">Przekroczono</span>
                        ) : ratio >= 0.8 ? (
                          <span className="text-amber-600 font-semibold">Blisko limitu</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
