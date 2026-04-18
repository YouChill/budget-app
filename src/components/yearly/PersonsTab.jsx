import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../utils/calculations';
import {
  CATEGORY_COLORS,
  UserIcon, PieTooltip, CustomLegend, renderPieLabel,
} from './primitives';

export default function PersonsTab({ personData, personPieData }) {
  if (personData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-white/50 backdrop-blur border border-gray-100 shadow-sm p-12 text-center">
          <div className="text-gray-300 flex justify-center mb-4"><UserIcon /></div>
          <p className="text-gray-500 text-sm">Brak danych o osobach w tym roku</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
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
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Przychody</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(person.przychody)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(person.przychody / maxVal) * 100}%` }} />
                </div>
              </div>
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
    </div>
  );
}
