import { useState } from 'react';
import Button from '../Button';
import { SparkleIcon } from './icons';
import { FILTRY_STATUSU } from './statusy';
import PreviewTable from './PreviewTable';
import RulesPanel from './RulesPanel';

// Krok 3: podgląd i edycja wierszy przed importem — status AI, reguły,
// filtr grup rozpoznawania zaksięgowanych i przycisk importu.
export default function PreviewStep({
  transactions,
  txMeta,
  kategorie,
  aiEnabled,
  aiLoading,
  aiMatchCount,
  unmappedCount,
  lastSaved,
  ruleNotification,
  onDismissRuleNotification,
  dedupInfo,
  liczbyStatusow,
  liczbaDoImportu,
  isLoading,
  rules,
  onAddRule,
  onDeleteRule,
  onEdit,
  onDedupChange,
  onDelete,
  onBack,
  onImport,
}) {
  // Filtr grup w podglądzie: wszystkie / nowe / zaksięgowane / z faktury / do weryfikacji
  const [filtrStatusu, setFiltrStatusu] = useState('wszystkie');

  // Details column
  const [showDetailsColumn, setShowDetailsColumn] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRowExpand = (idx) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-4">

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg text-gray-800">
            Podgląd importu
            <span className="ml-2 text-sm font-normal text-gray-400">({transactions.length})</span>
          </h3>
          {unmappedCount > 0 && !aiLoading && (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
              {unmappedCount} bez kategorii
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-gray-500">
              Zapis: {lastSaved.toLocaleTimeString('pl-PL')}
            </span>
          )}
          <button
            onClick={() => setShowDetailsColumn(!showDetailsColumn)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showDetailsColumn
                ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {showDetailsColumn ? 'Ukryj szczegóły' : 'Szczegóły CSV'}
          </button>
        </div>
      </div>

      {/* AI loading indicator */}
      {aiLoading && (
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-700">
          <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>AI wyszukuje dopasowania kategorii dla nieprzypisanych transakcji…</span>
        </div>
      )}

      {/* AI success badge */}
      {!aiLoading && aiMatchCount > 0 && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 text-sm text-violet-700">
          <span className="text-violet-500"><SparkleIcon /></span>
          AI automatycznie przypisało <strong>{aiMatchCount}</strong> transakcji na podstawie historii kategoryzacji
        </div>
      )}

      {/* Rule notification */}
      {ruleNotification && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-emerald-800">
            <span className="text-emerald-500 font-bold">✓</span>
            <span>
              <strong>Reguła dodana{aiEnabled ? ' i zapisana w AI' : ''}!</strong>
              {ruleNotification.matchCount > 0 ? (
                <> Przypisano <strong>{ruleNotification.matchCount}</strong> transakcji → <strong>{ruleNotification.kategoria}</strong>{ruleNotification.podkategoria && <> &gt; {ruleNotification.podkategoria}</>}</>
              ) : (
                <> Brak pasujących nieprzypisanych transakcji</>
              )}
            </span>
          </div>
          <button onClick={onDismissRuleNotification} aria-label="Zamknij powiadomienie o regule" className="text-emerald-400 hover:text-emerald-600 ml-2">✕</button>
        </div>
      )}

      {/* Rozpoznawanie już zaksięgowanych */}
      {dedupInfo && !dedupInfo.dostepny && (
        <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Nie sprawdzono duplikatów.</strong>{' '}
          {dedupInfo.powod === 'migracja'
            ? 'Baza nie ma jeszcze migracji 014 — import zapisze wszystkie wiersze, także te już wgrane.'
            : 'Nie udało się połączyć z bazą w celu sprawdzenia odcisków. Upewnij się, że ten wyciąg nie był już importowany.'}
        </div>
      )}
      {dedupInfo?.dostepny && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtr wierszy importu">
          {FILTRY_STATUSU.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={filtrStatusu === id}
              onClick={() => setFiltrStatusu(id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filtrStatusu === id
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label} <span className="opacity-75">({liczbyStatusow[id] ?? 0})</span>
            </button>
          ))}
        </div>
      )}

      {/* Transactions table */}
      <PreviewTable
        transactions={transactions}
        txMeta={txMeta}
        kategorie={kategorie}
        dedupInfo={dedupInfo}
        filtrStatusu={filtrStatusu}
        showDetailsColumn={showDetailsColumn}
        expandedRows={expandedRows}
        toggleRowExpand={toggleRowExpand}
        onEdit={onEdit}
        onDedupChange={onDedupChange}
        onDelete={onDelete}
      />

      <RulesPanel
        rules={rules}
        unmappedCount={unmappedCount}
        aiEnabled={aiEnabled}
        kategorie={kategorie}
        onAddRule={onAddRule}
        onDeleteRule={onDeleteRule}
      />

      {/* Bottom actions */}
      <div className="flex gap-3 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onBack}>
          ← Wstecz
        </Button>
        <Button className="flex-1" onClick={onImport} disabled={isLoading || aiLoading}>
          {isLoading ? (
            <>
              <svg aria-hidden="true" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Importuję…
            </>
          ) : (
            `Importuj ${liczbaDoImportu} transakcji`
          )}
        </Button>
      </div>
    </div>
  );
}
