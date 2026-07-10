import React, { useState, useMemo, useEffect } from 'react';
import * as api from '../src/services/api';
import ModalShell from '../src/components/ModalShell';
import ConfirmDialog from '../src/components/ConfirmDialog';
import { useToast } from '../src/contexts/ToastContext';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const MONTH_NAMES = [
  '', 'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export default function Budgets({ onClose, kategorie = {}, month, year, budgets = [], onSaved, osoby = [] }) {
  const expenseCats = Object.keys(kategorie['Wydatek'] || {});
  const { addToast } = useToast();

  const [form, setForm] = useState({
    kategoria: expenseCats[0] || '',
    limit: '',
    miesiac: month || new Date().getMonth() + 1,
    rok: year || new Date().getFullYear(),
    osoba: '',
    zakres: 'monthly',
    notatki: '',
  });

  const [allBudgets, setAllBudgets] = useState([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmOverride, setConfirmOverride] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Pobierz wszystkie budżety dla roku (do widoku zarządzania)
  const fetchAllBudgets = async () => {
    setIsLoadingAll(true);
    try {
      const data = await api.getAllBudgetsForYear(form.rok);
      setAllBudgets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Nie udało się pobrać budżetów rocznych', err);
    } finally {
      setIsLoadingAll(false);
    }
  };

  useEffect(() => {
    fetchAllBudgets();
  }, [form.rok]);

  // Grupowanie budżetów do widoku drzewa: { kategoria+osoba → { yearly, monthly: []} }
  const budgetTree = useMemo(() => {
    const tree = {};
    allBudgets.forEach(b => {
      const key = b.kategoria + '|' + (b.osoba || '');
      if (!tree[key]) {
        tree[key] = { kategoria: b.kategoria, osoba: b.osoba || '', yearly: null, monthly: [] };
      }
      if (b.zakres === 'yearly') {
        tree[key].yearly = b;
      } else {
        tree[key].monthly.push(b);
      }
    });

    // Sortuj monthly po miesiącu
    Object.values(tree).forEach(entry => {
      entry.monthly.sort((a, b) => (a.miesiac || 0) - (b.miesiac || 0));
    });

    return tree;
  }, [allBudgets]);

  // Sprawdź czy istnieje budżet roczny dla wybranej kategorii/osoby
  const existingYearly = useMemo(() => {
    return allBudgets.find(b =>
      b.kategoria === form.kategoria &&
      (b.osoba || '') === form.osoba &&
      b.zakres === 'yearly' &&
      Number(b.rok) === Number(form.rok)
    );
  }, [allBudgets, form.kategoria, form.osoba, form.rok]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.kategoria) return;

    // Ostrzeżenie: tworzenie budżetu miesięcznego gdy istnieje roczny
    if (form.zakres === 'monthly' && existingYearly && !confirmOverride) {
      setConfirmOverride({
        message: `Kategoria "${form.kategoria}" ma budżet roczny ${formatCurrency(existingYearly.limit)}. Budżet miesięczny nadpisze go dla ${MONTH_NAMES[form.miesiac]} ${form.rok}.`,
        onConfirm: () => {
          setConfirmOverride(null);
          doSave();
        }
      });
      return;
    }

    await doSave();
  };

  const doSave = async () => {
    const limitNum = Number(String(form.limit).replace(',', '.'));
    if (!Number.isFinite(limitNum) || limitNum < 0) {
      addToast('Podaj poprawny limit (liczba ≥ 0)', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const budgetData = {
        kategoria: form.kategoria,
        limit: limitNum,
        rok: Number(form.rok),
        osoba: form.osoba,
        zakres: form.zakres,
        notatki: form.notatki,
      };
      if (form.zakres === 'monthly') {
        budgetData.miesiac = Number(form.miesiac);
      }

      const data = await api.setBudget(budgetData);
      if (data.success) {
        await fetchAllBudgets();
        if (onSaved) onSaved();
        setForm(prev => ({ ...prev, limit: '', notatki: '' }));
        addToast(`Zapisano budżet dla "${budgetData.kategoria}"`);
      }
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Błąd zapisu budżetu', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (budget) => setConfirmDelete(budget);

  const performDelete = async (budget) => {
    try {
      const data = await api.deleteBudget(budget);
      if (data.success) {
        await fetchAllBudgets();
        if (onSaved) onSaved();
        addToast('Budżet został usunięty');
      }
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Błąd usuwania budżetu', 'error');
    }
  };

  const handleLoadExisting = (budget) => {
    setForm({
      kategoria: budget.kategoria,
      limit: budget.limit || '',
      miesiac: budget.miesiac || month,
      rok: budget.rok || year,
      osoba: budget.osoba || '',
      zakres: budget.zakres || 'monthly',
      notatki: budget.notatki || '',
    });
  };

  return (
    <>
      <ModalShell onClose={onClose} labelId="budgets-title" maxWidth="max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <h2 id="budgets-title" className="text-xl font-semibold text-gray-800">Budżety</h2>
          <button onClick={onClose} aria-label="Zamknij budżety" className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Formularz */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* Zakres - toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Zakres budżetu</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, zakres: 'monthly' }))}
                  className={`flex-1 rounded-xl py-2.5 px-3 text-sm font-medium transition-all ${
                    form.zakres === 'monthly'
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Miesięczny
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, zakres: 'yearly' }))}
                  className={`flex-1 rounded-xl py-2.5 px-3 text-sm font-medium transition-all ${
                    form.zakres === 'yearly'
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Roczny
                  </div>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {form.zakres === 'yearly'
                  ? 'Budżet stosowany automatycznie do wszystkich miesięcy roku'
                  : 'Budżet tylko dla wybranego miesiąca (nadpisuje roczny)'}
              </p>
            </div>

            {/* Kategoria */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Kategoria</label>
              <select
                value={form.kategoria}
                onChange={e => setForm(prev => ({ ...prev, kategoria: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
              >
                {expenseCats.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            {/* Osoba */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Osoba</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, osoba: '' }))}
                  className={`rounded-xl py-2 px-3 text-sm font-medium transition-all ${
                    form.osoba === ''
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Wszyscy
                </button>
                {osoby.map(o => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, osoba: o }))}
                    className={`rounded-xl py-2 px-3 text-sm font-medium transition-all ${
                      form.osoba === o
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Limit + Okres — na mobile limit zajmuje pełny wiersz */}
            <div className={`grid gap-3 ${form.zakres === 'monthly' ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <div className={form.zakres === 'monthly' ? 'col-span-2 sm:col-span-3' : ''}>
                <label className="block text-sm text-gray-600 mb-2">Limit (PLN)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.limit}
                  onChange={e => setForm(prev => ({ ...prev, limit: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  placeholder="0"
                  required
                />
              </div>
              {form.zakres === 'monthly' && (
                <div className="flex flex-col">
                  <label className="block text-sm text-gray-600 mb-2">Miesiąc</label>
                  <select
                    value={form.miesiac}
                    onChange={e => setForm(prev => ({ ...prev, miesiac: Number(e.target.value) }))}
                    className="w-full flex-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{MONTH_NAMES[m]}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-2">Rok</label>
                <input
                  type="number"
                  value={form.rok}
                  onChange={e => setForm(prev => ({ ...prev, rok: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
            </div>

            {/* Notatki */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">Notatki (opcjonalnie)</label>
              <input
                type="text"
                value={form.notatki}
                onChange={e => setForm(prev => ({ ...prev, notatki: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                placeholder="np. Święta, wakacje..."
              />
            </div>

            {/* Info o nadpisaniu rocznego */}
            {form.zakres === 'monthly' && existingYearly && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span>Istnieje budżet roczny: {formatCurrency(existingYearly.limit)}/mies. Budżet miesięczny nadpisze go dla wybranego miesiąca.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving || !form.limit}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <><svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Zapisywanie...</>
              ) : (
                'Zapisz budżet'
              )}
            </button>
          </form>

          {/* Lista budżetów - widok drzewa */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              Budżety na {form.rok}
              {isLoadingAll && <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
            </h3>

            {Object.keys(budgetTree).length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Brak budżetów na ten rok</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(budgetTree).map(([key, entry]) => (
                  <div key={key} className="rounded-xl border border-gray-100 overflow-hidden">
                    {/* Header kategorii */}
                    <div className="bg-gray-50/50 px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-800">{entry.kategoria}</span>
                        {entry.osoba && (
                          <span className="text-xs text-gray-500 ml-2">({entry.osoba})</span>
                        )}
                        {!entry.osoba && (
                          <span className="text-xs text-gray-400 ml-2">(Wszyscy)</span>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {/* Budżet roczny */}
                      {entry.yearly && (
                        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                            <span className="text-xs font-medium text-purple-600 uppercase">Roczny</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-gray-800">{formatCurrency(entry.yearly.limit)}</span>
                            <span className="text-xs text-gray-400 ml-1">/mies.</span>
                            {entry.yearly.notatki && (
                              <span className="text-xs text-gray-400 ml-2 truncate">— {entry.yearly.notatki}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleLoadExisting(entry.yearly)}
                              className="rounded-lg p-2.5 text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 transition-all"
                              title="Edytuj"
                              aria-label={`Edytuj budżet roczny ${entry.kategoria}`}
                            >
                              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(entry.yearly)}
                              className="rounded-lg p-2.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all"
                              title="Usuń"
                              aria-label={`Usuń budżet roczny ${entry.kategoria}`}
                            >
                              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Budżety miesięczne */}
                      {entry.monthly.map(mb => (
                        <div key={`${mb.miesiac}-${mb.rok}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                            <span className="text-xs font-medium text-indigo-600">{MONTH_NAMES[mb.miesiac]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-gray-800">{formatCurrency(mb.limit)}</span>
                            {entry.yearly && (
                              <span className="text-xs text-amber-600 ml-2">(nadpisuje roczny)</span>
                            )}
                            {mb.notatki && (
                              <span className="text-xs text-gray-400 ml-2 truncate">— {mb.notatki}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleLoadExisting(mb)}
                              className="rounded-lg p-2.5 text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 transition-all"
                              title="Edytuj"
                              aria-label={`Edytuj budżet ${entry.kategoria} — ${MONTH_NAMES[mb.miesiac]}`}
                            >
                              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(mb)}
                              className="rounded-lg p-2.5 text-gray-400 hover:bg-rose-100 hover:text-rose-600 transition-all"
                              title="Usuń"
                              aria-label={`Usuń budżet ${entry.kategoria} — ${MONTH_NAMES[mb.miesiac]}`}
                            >
                              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalShell>

      {/* Dialog potwierdzenia nadpisania rocznego */}
      {confirmOverride && (
        <ConfirmDialog
          title="Nadpisanie budżetu rocznego"
          message={confirmOverride.message}
          confirmLabel="Nadpisz"
          isWarning
          onConfirm={confirmOverride.onConfirm}
          onCancel={() => setConfirmOverride(null)}
        />
      )}

      {/* Dialog potwierdzenia usunięcia */}
      {confirmDelete && (
        <ConfirmDialog
          title="Usunąć budżet?"
          message={`Czy na pewno chcesz usunąć budżet ${confirmDelete.zakres === 'yearly' ? 'roczny' : 'miesięczny'} dla "${confirmDelete.kategoria}"?`}
          onConfirm={() => {
            const budget = confirmDelete;
            setConfirmDelete(null);
            performDelete(budget);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
