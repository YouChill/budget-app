import React, { useMemo, useState } from 'react';

const MONTH_NAMES = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function Budgets({
  onClose,
  kategorie = {},
  osoby = [],
  apiUrl,
  month,
  year,
  budgets = [],
  onSaved,
  authToken
}) {
  const expenseCats = Object.keys(kategorie.Wydatek || {});
  const people = useMemo(() => ['Wszyscy', ...(osoby || [])], [osoby]);

  const [form, setForm] = useState({
    kategoria: expenseCats[0] || '',
    osoba: 'Wszyscy',
    scope: 'monthly',
    limit: '',
    miesiac: month || new Date().getMonth() + 1,
    rok: year || new Date().getFullYear(),
    notes: '',
  });

  const groupedBudgets = useMemo(() => {
    const map = {};
    (budgets || []).forEach((activeBudget) => {
      const key = [activeBudget.kategoria, activeBudget.osoba || 'Wszyscy'].join('::');
      if (!map[key]) {
        map[key] = {
          kategoria: activeBudget.kategoria,
          osoba: activeBudget.osoba || 'Wszyscy',
          yearlyBudget: activeBudget.yearlyBudget || null,
          monthlyBudget: activeBudget.monthlyBudget || null,
          activeLimit: Number(activeBudget.limit) || 0,
          source: activeBudget.source,
          isOverride: Boolean(activeBudget.isOverride),
        };
      }
    });
    return Object.values(map).sort((a, b) => a.kategoria.localeCompare(b.kategoria, 'pl'));
  }, [budgets]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.kategoria) return;

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'setBudget', budget: form, token: authToken })
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

  const handleDeleteBudget = async (budget) => {
    if (!window.confirm('Czy na pewno usunąć ten budżet?')) return;

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteBudget', budget, token: authToken })
      });
      const data = await res.json();
      if (data.success) {
        if (onSaved) onSaved();
      } else {
        alert(data.error || 'Nie udało się usunąć budżetu');
      }
    } catch (err) {
      console.error(err);
      alert('Błąd połączenia');
    }
  };

  const handleLoadBudgetToForm = (budget) => {
    setForm({
      kategoria: budget.kategoria,
      osoba: budget.osoba || 'Wszyscy',
      scope: budget.scope,
      limit: budget.limit || '',
      miesiac: budget.miesiac || month,
      rok: budget.rok || year,
      notes: budget.notes || '',
    });
  };

  const yearlyForSelection = useMemo(() => {
    return (budgets || []).find((b) => (
      b.kategoria === form.kategoria &&
      (b.osoba || 'Wszyscy') === (form.osoba || 'Wszyscy') &&
      b.yearlyBudget
    ))?.yearlyBudget || null;
  }, [budgets, form.kategoria, form.osoba]);

  const monthlyForSelection = useMemo(() => {
    return (budgets || []).find((b) => (
      b.kategoria === form.kategoria &&
      (b.osoba || 'Wszyscy') === (form.osoba || 'Wszyscy') &&
      b.monthlyBudget
    ))?.monthlyBudget || null;
  }, [budgets, form.kategoria, form.osoba]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-800">Budżety</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100">Zamknij</button>
        </div>

        <div className="p-6 grid lg:grid-cols-2 gap-6">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Ustaw budżet</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Kategoria</label>
                <select value={form.kategoria} onChange={e => setForm(prev => ({ ...prev, kategoria: e.target.value }))} className="w-full rounded-xl border px-4 py-3">
                  {expenseCats.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Osoba</label>
                <select value={form.osoba} onChange={e => setForm(prev => ({ ...prev, osoba: e.target.value }))} className="w-full rounded-xl border px-4 py-3">
                  {people.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Zakres budżetu</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, scope: 'monthly' }))}
                    className={`rounded-xl border px-3 py-2 text-sm ${form.scope === 'monthly' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    Miesięczny
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, scope: 'yearly' }))}
                    className={`rounded-xl border px-3 py-2 text-sm ${form.scope === 'yearly' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    Roczny
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {form.scope === 'monthly'
                    ? `Budżet tylko dla ${MONTH_NAMES[(form.miesiac || 1) - 1]} ${form.rok}.`
                    : `Budżet domyślny dla całego ${form.rok} roku.`}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Limit (PLN)</label>
                  <input type="number" step="0.01" value={form.limit} onChange={e => setForm(prev => ({ ...prev, limit: e.target.value }))} className="w-full rounded-xl border px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Miesiąc</label>
                  <input
                    disabled={form.scope === 'yearly'}
                    type="number"
                    min="1"
                    max="12"
                    value={form.miesiac}
                    onChange={e => setForm(prev => ({ ...prev, miesiac: Number(e.target.value) }))}
                    className="w-full rounded-xl border px-4 py-3 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Rok</label>
                  <input type="number" value={form.rok} onChange={e => setForm(prev => ({ ...prev, rok: Number(e.target.value) }))} className="w-full rounded-xl border px-4 py-3" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">Notatki (opcjonalnie)</label>
                <input type="text" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full rounded-xl border px-4 py-3" />
              </div>

              {form.scope === 'monthly' && yearlyForSelection && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Dla tej kategorii istnieje już budżet roczny ({formatCurrency(yearlyForSelection.limit)}). Ten wpis miesięczny go nadpisze.
                </div>
              )}

              {form.scope === 'yearly' && monthlyForSelection && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                  W tym miesiącu istnieje nadpisanie miesięczne ({formatCurrency(monthlyForSelection.limit)}), które będzie miało wyższy priorytet.
                </div>
              )}

              <div className="flex items-center gap-2">
                <button type="submit" className="rounded-xl bg-indigo-600 text-white px-4 py-2">Zapisz</button>
              </div>
            </form>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Aktywne budżety ({MONTH_NAMES[(month || 1) - 1]} {year})</h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {groupedBudgets.length === 0 && (
                <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">Brak budżetów dla wybranego okresu.</div>
              )}

              {groupedBudgets.map((group) => (
                <div key={`${group.kategoria}-${group.osoba}`} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-800">{group.kategoria} <span className="text-gray-400">({group.osoba})</span></div>
                      <div className="text-sm mt-1">
                        Budżet aktywny: <span className="font-semibold">{formatCurrency(group.activeLimit)}</span>
                        {group.source === 'monthly' && <span className="text-indigo-600"> (miesięczny)</span>}
                        {group.source === 'yearly' && <span className="text-emerald-600"> (roczny)</span>}
                      </div>
                      {group.isOverride && (
                        <div className="text-xs text-gray-500 mt-1">Nadpisanie: {formatCurrency(group.monthlyBudget.limit)} zamiast rocznego {formatCurrency(group.yearlyBudget.limit)}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {group.yearlyBudget && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-emerald-800">Roczny {group.yearlyBudget.rok}: {formatCurrency(group.yearlyBudget.limit)}</div>
                          {group.yearlyBudget.notes && <div className="text-xs text-emerald-700">{group.yearlyBudget.notes}</div>}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleLoadBudgetToForm(group.yearlyBudget)} className="text-xs text-gray-600 hover:text-gray-900">Edytuj</button>
                          <button type="button" onClick={() => handleDeleteBudget(group.yearlyBudget)} className="text-xs text-rose-600 hover:text-rose-800">Usuń</button>
                        </div>
                      </div>
                    )}

                    {group.monthlyBudget && (
                      <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-indigo-800">
                            {MONTH_NAMES[(group.monthlyBudget.miesiac || 1) - 1]} {group.monthlyBudget.rok}: {formatCurrency(group.monthlyBudget.limit)}
                            {group.yearlyBudget ? ' (nadpisuje roczny)' : ''}
                          </div>
                          {group.monthlyBudget.notes && <div className="text-xs text-indigo-700">{group.monthlyBudget.notes}</div>}
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleLoadBudgetToForm(group.monthlyBudget)} className="text-xs text-gray-600 hover:text-gray-900">Edytuj</button>
                          <button type="button" onClick={() => handleDeleteBudget(group.monthlyBudget)} className="text-xs text-rose-600 hover:text-rose-800">Usuń</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
