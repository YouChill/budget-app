// używane przez widok Do rozliczenia (#132)
import React from 'react';
import { parseKwota } from '../../lib/csvImport/parsowanie';
import DedupInfo from './DedupInfo';
import { pasujeDoFiltra } from './statusy';

// Edytowalna tabela wierszy importu: wybór do importu (gdy działa
// rozpoznawanie zaksięgowanych), data, kwota, opis, kategoria, szczegóły CSV.
export default function PreviewTable({
  transactions,
  txMeta,
  kategorie,
  dedupInfo,
  filtrStatusu,
  showDetailsColumn,
  expandedRows,
  toggleRowExpand,
  onEdit,
  onDedupChange,
  onDelete,
}) {
  return (
    <div className="overflow-auto border border-gray-200 rounded-xl max-h-[38vh]">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 z-[1]">
          <tr>
            {dedupInfo?.dostepny && (
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span className="sr-only">Importuj</span>✓
              </th>
            )}
            <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
            <th className="px-3 py-2.5 text-right whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Kwota</th>
            <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Opis</th>
            <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategoria</th>
            <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Podkategoria</th>
            {showDetailsColumn && (
              <th className="px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Szczegóły</th>
            )}
            <th className="px-3 py-2.5 text-center whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide">Akcje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx, idx) => pasujeDoFiltra(tx, filtrStatusu) && (
            <React.Fragment key={idx}>
              <tr className={`hover:bg-gray-50/70 transition-colors ${
                tx._dedup?.wybrana === false
                  ? 'opacity-50'
                  : tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane'
                  ? 'bg-amber-50/40'
                  : ''
              }`}>
                {dedupInfo?.dostepny && (
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={tx._dedup?.wybrana !== false}
                      // Zaksięgowana z żywą transakcją: RPC i tak by ją pominęło.
                      disabled={tx._dedup?.status === 'zaksiegowana' && tx._dedup?.istniejacaTransakcja !== null}
                      onChange={e => onDedupChange(idx, { wybrana: e.target.checked })}
                      aria-label={`Importuj wiersz ${idx + 1}`}
                      className="w-4 h-4 accent-indigo-600"
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={tx.data}
                    onChange={e => onEdit(idx, 'data', e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 w-full min-w-[130px] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tx.kwota}
                    onChange={e => {
                      const raw = e.target.value;
                      const normalized = raw.replace(',', '.');
                      if (normalized === '' || normalized === '-' || /^-?\d*\.?\d*$/.test(normalized)) {
                        onEdit(idx, 'kwota', normalized);
                      }
                    }}
                    onBlur={e => onEdit(idx, 'kwota', parseKwota(e.target.value))}
                    className="border border-gray-200 rounded-lg px-2 py-1 w-full text-right min-w-[90px] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={tx.opis}
                    onChange={e => onEdit(idx, 'opis', e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 w-full text-sm min-w-[120px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                  {tx._dedup && <DedupInfo dedup={tx._dedup} onChange={zmiany => onDedupChange(idx, zmiany)} />}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={tx.kategoria}
                    onChange={e => onEdit(idx, 'kategoria', e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 w-full text-sm min-w-[110px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    {Object.keys(kategorie?.[tx.typ] || {}).map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={tx.podkategoria}
                    onChange={e => onEdit(idx, 'podkategoria', e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 w-full text-sm min-w-[120px] focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    {(kategorie?.[tx.typ]?.[tx.kategoria] || []).map(pk => (
                      <option key={pk} value={pk}>{pk}</option>
                    ))}
                  </select>
                </td>
                {showDetailsColumn && (
                  <td className="px-3 py-2 hidden md:table-cell">
                    <div className="text-xs text-gray-400 space-y-0.5 max-w-[200px]">
                      {txMeta[idx]?._originalOpis && txMeta[idx]._originalOpis !== tx.opis && (
                        <div><span className="font-medium text-gray-500">Oryg:</span> {txMeta[idx]._originalOpis}</div>
                      )}
                      {txMeta[idx]?._csvRaw && Object.entries(txMeta[idx]._csvRaw).map(([key, value]) =>
                        value ? <div key={key} className="truncate"><span className="font-medium text-gray-500">{key}:</span> {value}</div> : null
                      )}
                    </div>
                  </td>
                )}
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {showDetailsColumn && (
                      <button
                        onClick={() => toggleRowExpand(idx)}
                        className="md:hidden text-indigo-400 hover:text-indigo-600 text-xs px-1"
                      >
                        {expandedRows.has(idx) ? '▲' : '▼'}
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(idx)}
                      aria-label={`Usuń wiersz ${idx + 1} z importu`}
                      className="text-rose-400 hover:text-rose-600 font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-rose-50 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
              {showDetailsColumn && expandedRows.has(idx) && (
                <tr className="md:hidden border-t bg-gray-50">
                  <td colSpan={dedupInfo?.dostepny ? 8 : 7} className="px-4 py-2 text-xs text-gray-500 space-y-1">
                    {txMeta[idx]?._originalOpis && txMeta[idx]._originalOpis !== tx.opis && (
                      <div><span className="font-medium text-gray-600">Oryginalny opis:</span> {txMeta[idx]._originalOpis}</div>
                    )}
                    {txMeta[idx]?._csvRaw && Object.entries(txMeta[idx]._csvRaw).map(([key, value]) =>
                      value ? <div key={key}><span className="font-medium text-gray-600">{key}:</span> {value}</div> : null
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
