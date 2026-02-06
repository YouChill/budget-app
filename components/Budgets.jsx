import React, { useState, useMemo } from 'react';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function Budgets({ onClose, kategorie = {}, apiUrl, month, year, budgets = [], onSaved }) {
  const expenseCats = Object.keys(kategorie['Wydatek'] || {});

  const [form, setForm] = useState({
    kategoria: expenseCats[0] || '',
    limit: '',
    miesiac: month || new Date().getMonth() + 1,
    rok: year || new Date().getFullYear(),
  });

  const existingMap = useMemo(() => {
    const map = {};
    (budgets || []).forEach(b => {
      if (b.kategoria) map[b.kategoria] = b;
    });
    return map;
  }, [budgets]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.kategoria) return;

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'setBudget', budget: form })
      });
      const data = await res.json();
      if (data.success) {
        if (onSaved) onSaved();
      } else {
        alert(data.error || 'Błąd zapisu budżetu');
      }
    } catch (err) {
      console.error(err);
      alert('Błąd połączenia');
    }
  };

  const handleSelectExisting = (k) => {
    const b = existingMap[k];
    if (b) {
      setForm({
        kategoria: b.kategoria,
        limit: b.limit || '',
        miesiac: b.miesiac || month,
        rok: b.rok || year
      });
    } else {
      setForm(prev => ({ ...prev, kategoria: k, limit: '' }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Budżety</h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100">Zamknij</button>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Kategoria</label>
              <select value={form.kategoria} onChange={e => setForm(prev => ({ ...prev, kategoria: e.target.value }))} className="w-full rounded-xl border px-4 py-3">
                {expenseCats.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Limit (PLN)</label>
                <input type="number" step="0.01" value={form.limit} onChange={e => setForm(prev => ({ ...prev, limit: e.target.value }))} className="w-full rounded-xl border px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Miesiąc</label>
                <input type="number" min="1" max="12" value={form.miesiac} onChange={e => setForm(prev => ({ ...prev, miesiac: Number(e.target.value) }))} className="w-full rounded-xl border px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Rok</label>
                <input type="number" value={form.rok} onChange={e => setForm(prev => ({ ...prev, rok: Number(e.target.value) }))} className="w-full rounded-xl border px-4 py-3" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="submit" className="rounded-xl bg-indigo-600 text-white px-4 py-2">Zapisz</button>
              <button type="button" onClick={() => handleSelectExisting(form.kategoria)} className="text-sm text-gray-500">Wczytaj istniejący</button>
            </div>
          </form>

          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Budżety w tym miesiącu</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(budgets || []).map(b => (
                <div key={`${b.kategoria}-${b.miesiac}-${b.rok}`} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                  <div>
                    <div className="font-medium text-gray-800">{b.kategoria}</div>
                    <div className="text-xs text-gray-500">{b.miesiac}/{b.rok}</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-800">{formatCurrency(b.limit)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
