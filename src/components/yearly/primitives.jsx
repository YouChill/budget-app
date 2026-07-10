import { formatCurrency } from '../../utils/calculations';

// Shared palette + chart tooltips + KPI card used across all yearly-summary tabs.

export const CATEGORY_COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#ef4444', '#14b8a6',
  '#a855f7', '#f97316', '#3b82f6', '#eab308', '#22d3ee',
];

export const TrendUpIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
export const TrendDownIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
  </svg>
);
export const WalletIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);
export const PiggyIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2" />
    <path d="M2 9.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0" />
  </svg>
);
export const LoaderIcon = () => (
  <svg aria-hidden="true" className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
export const CalendarSearchIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
export const UserIcon = () => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

export const MonthlyBarTooltip = ({ active, payload, label }) => {
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

export const AreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
      <p className="font-semibold text-gray-800 text-sm">{label}</p>
      <p className="text-indigo-600 text-sm">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3">
      <p className="font-semibold text-gray-800 text-sm">{d.name}</p>
      <p className="text-gray-600 text-sm">{formatCurrency(d.value)}</p>
    </div>
  );
};

export const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
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

export const CustomLegend = ({ payload }) => {
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

export const KpiCard = ({ title, amount, icon, gradient, yoy }) => (
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
