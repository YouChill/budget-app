import { useState } from 'react';
import Button from '../Button';
import { SparkleIcon } from './icons';

const PUSTA_REGULA = { keyword: '', kategoria: '', podkategoria: '', typ: 'Wydatek' };

// Reguły rozpoznawania: lista zapisanych i formularz nowej reguły
// („jeśli opis zawiera X → kategoria"). Dodanie stosuje regułę od razu.
export default function RulesPanel({ rules, unmappedCount, aiEnabled, kategorie, onAddRule, onDeleteRule }) {
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showRulesList, setShowRulesList] = useState(false);
  const [ruleForm, setRuleForm] = useState(PUSTA_REGULA);

  const ruleCategories = Object.keys(kategorie?.[ruleForm.typ] || {});
  const ruleSubcategories = kategorie?.[ruleForm.typ]?.[ruleForm.kategoria] || [];

  // onAddRule waliduje, zapisuje w bazie i zwraca true po dodaniu — dopiero
  // wtedy czyścimy formularz.
  const handleAddRule = async () => {
    if (await onAddRule(ruleForm)) {
      setRuleForm(PUSTA_REGULA);
      setShowRuleForm(false);
    }
  };

  return (
    <div className="border border-indigo-200 rounded-xl bg-indigo-50/50 overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-indigo-700 font-semibold text-sm">Reguły rozpoznawania</span>
          {rules.length > 0 && (
            <span className="text-xs bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {rules.length}
            </span>
          )}
          {unmappedCount > 0 && (
            <span className="text-xs text-amber-600 font-medium">
              {unmappedCount} nieprzypisanych
            </span>
          )}
          {aiEnabled && (
            <span className="text-xs text-violet-500 flex items-center gap-1">
              <SparkleIcon size={12} /> Zapisywane w AI
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {rules.length > 0 && (
            <button
              onClick={() => { setShowRulesList(!showRulesList); setShowRuleForm(false); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              {showRulesList ? 'Ukryj' : 'Lista reguł'}
            </button>
          )}
          <button
            onClick={() => { setShowRuleForm(!showRuleForm); setShowRulesList(false); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
          >
            {showRuleForm ? 'Anuluj' : '+ Dodaj regułę'}
          </button>
        </div>
      </div>

      {/* Rules list */}
      {showRulesList && rules.length > 0 && (
        <div className="px-4 pb-3 border-t border-indigo-200 pt-3">
          <div className="space-y-1.5 max-h-32 overflow-auto">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 text-xs border border-indigo-100">
                <span>
                  Jeśli zawiera „<strong>{rule.keyword}</strong>" →{' '}
                  <span className="text-indigo-600 font-medium">{rule.kategoria}</span>
                  {rule.podkategoria && <> &gt; <span className="text-indigo-500">{rule.podkategoria}</span></>}
                  {rule.typ && <span className="text-gray-400 ml-1">({rule.typ})</span>}
                </span>
                <button
                  onClick={() => onDeleteRule(rule.id)}
                  aria-label={`Usuń regułę „${rule.keyword}"`}
                  className="text-rose-400 hover:text-rose-600 ml-2 font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add rule form */}
      {showRuleForm && (
        <div className="px-4 pb-4 border-t border-indigo-200 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tekst w opisie</label>
              <input
                type="text"
                value={ruleForm.keyword}
                onChange={e => setRuleForm(prev => ({ ...prev, keyword: e.target.value }))}
                placeholder="np. Biedronka, Allegro…"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
              <select
                value={ruleForm.typ}
                onChange={e => setRuleForm(prev => ({ ...prev, typ: e.target.value, kategoria: '', podkategoria: '' }))}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
              >
                <option value="Wydatek">Wydatek</option>
                <option value="Przychód">Przychód</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kategoria</label>
              <select
                value={ruleForm.kategoria}
                onChange={e => setRuleForm(prev => ({ ...prev, kategoria: e.target.value, podkategoria: '' }))}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
              >
                <option value="">Wybierz…</option>
                {ruleCategories.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Podkategoria</label>
              <select
                value={ruleForm.podkategoria}
                onChange={e => setRuleForm(prev => ({ ...prev, podkategoria: e.target.value }))}
                disabled={!ruleForm.kategoria}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:opacity-50"
              >
                <option value="">Wybierz…</option>
                {ruleSubcategories.map(pk => <option key={pk} value={pk}>{pk}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="success" size="sm" className="w-full" onClick={handleAddRule}>
                Dodaj i zastosuj
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Reguła zostanie zastosowana natychmiast i zapisana w bazie — działa na każdym urządzeniu
            {aiEnabled && ' i trafia do bazy wektorowej AI'}. Tekst: min. 3 znaki.
          </p>
        </div>
      )}
    </div>
  );
}
