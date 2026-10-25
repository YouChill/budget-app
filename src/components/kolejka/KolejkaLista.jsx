import Button from '../Button';
import { SparkleIcon } from '../csvImport/icons';
import { FILTRY_STATUSU } from './statusy';
import KolejkaTabela from './KolejkaTabela';
import RulesPanel from './RulesPanel';

const nazwaMiesiaca = (ym) => {
  const [r, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(r, m - 1, 1)).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const pigulka = (aktywna) =>
  `text-xs px-3 py-1.5 rounded-full border transition-colors ${
    aktywna ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
  }`;

// Lista operacji do rozliczenia (dawniej krok 3 kreatora importu): status AI,
// reguły, filtry (parowanie, miesiąc, źródło), tabela i zatwierdzanie.
export default function KolejkaLista({
  widoczne,
  liczbaWszystkich,
  kategorie,
  osoby,
  filtry,
  setFiltry,
  liczbyStatusow,
  miesiace,
  zrodla,
  aiEnabled,
  aiLoading,
  aiMatchCount,
  unmappedCount,
  ruleNotification,
  onDismissRuleNotification,
  rules,
  onAddRule,
  onDeleteRule,
  liczbaDoZatwierdzenia,
  isSaving,
  onEdit,
  onUdzial,
  onDedupChange,
  onWyklucz,
  onZatwierdz,
}) {
  return (
    <div className="space-y-4 min-w-0">

      {/* AI */}
      {aiLoading && (
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-700">
          <svg aria-hidden="true" className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>AI wyszukuje dopasowania kategorii dla nieprzypisanych operacji…</span>
        </div>
      )}
      {!aiLoading && aiMatchCount > 0 && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 text-sm text-violet-700">
          <span className="text-violet-500"><SparkleIcon /></span>
          AI zaproponowało kategorię dla <strong>{aiMatchCount}</strong> operacji na podstawie historii kategoryzacji
        </div>
      )}

      {ruleNotification && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>
              <strong>Reguła dodana{aiEnabled ? ' i zapisana w AI' : ''}!</strong>
              {ruleNotification.matchCount > 0 ? (
                <> Przypisano <strong>{ruleNotification.matchCount}</strong> operacji → <strong>{ruleNotification.kategoria}</strong>{ruleNotification.podkategoria && <> &gt; {ruleNotification.podkategoria}</>}</>
              ) : (
                <> Brak pasujących nieprzypisanych operacji</>
              )}
            </span>
          </div>
          <button onClick={onDismissRuleNotification} aria-label="Zamknij powiadomienie o regule" className="text-emerald-400 hover:text-emerald-600 ml-2">✕</button>
        </div>
      )}

      {/* Filtry */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtr parowania">
          {FILTRY_STATUSU.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={filtry.status === id}
              onClick={() => setFiltry(f => ({ ...f, status: id }))}
              className={pigulka(filtry.status === id)}
            >
              {label} <span className="opacity-75">({liczbyStatusow[id] ?? 0})</span>
            </button>
          ))}
        </div>
        <select
          value={filtry.miesiac}
          onChange={e => setFiltry(f => ({ ...f, miesiac: e.target.value }))}
          aria-label="Miesiąc"
          className="text-xs border border-gray-300 rounded-full px-3 py-1.5 bg-white"
        >
          <option value="">Wszystkie miesiące</option>
          {miesiace.map(m => <option key={m} value={m}>{nazwaMiesiaca(m)}</option>)}
        </select>
        {zrodla.length > 1 && (
          <select
            value={filtry.zrodlo}
            onChange={e => setFiltry(f => ({ ...f, zrodlo: e.target.value }))}
            aria-label="Źródło"
            className="text-xs border border-gray-300 rounded-full px-3 py-1.5 bg-white"
          >
            <option value="">Wszystkie źródła</option>
            {zrodla.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        )}
        {unmappedCount > 0 && !aiLoading && (
          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
            {unmappedCount} bez kategorii
          </span>
        )}
      </div>

      {widoczne.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          {liczbaWszystkich === 0 ? 'Brak operacji do rozliczenia.' : 'Żadna operacja nie pasuje do filtrów.'}
        </p>
      ) : (
        <KolejkaTabela
          transactions={widoczne}
          kategorie={kategorie}
          osoby={osoby}
          onEdit={onEdit}
          onUdzial={onUdzial}
          onDedupChange={onDedupChange}
          onWyklucz={onWyklucz}
        />
      )}

      <RulesPanel
        rules={rules}
        unmappedCount={unmappedCount}
        aiEnabled={aiEnabled}
        kategorie={kategorie}
        onAddRule={onAddRule}
        onDeleteRule={onDeleteRule}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
        <p className="text-xs text-gray-500">
          Zatwierdzane są zaznaczone operacje widoczne po filtrach. Niezatwierdzone zmiany nie są zapisywane.
        </p>
        <Button onClick={onZatwierdz} disabled={isSaving || aiLoading || liczbaDoZatwierdzenia === 0}>
          {isSaving ? 'Zatwierdzanie…' : `Zatwierdź ${liczbaDoZatwierdzenia}`}
        </Button>
      </div>
    </div>
  );
}
