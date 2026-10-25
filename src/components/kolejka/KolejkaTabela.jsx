import DedupInfo from './DedupInfo';

const UDZIALY = ['1/2', '4/6'];

const formatKwota = (n) =>
  Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const naglowek = 'px-3 py-2.5 text-left whitespace-nowrap text-xs font-semibold text-gray-500 uppercase tracking-wide';
const pole = 'border border-gray-200 rounded-lg px-2 py-1 w-full text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300';

// Tabela operacji z kolejki. Kwota dowodu jest tylko do odczytu — udział
// (np. 1/2) liczy kwotę transakcji z brutto. Opis z banku wpisuje obca
// osoba (tytuł przelewu), więc renderujemy go wyłącznie jako tekst
// (wartość pola / węzeł tekstowy), bez HTML i bez autolinkowania.
// Na wąskim ekranie tabela przewija się poziomo w swoim kontenerze.
export default function KolejkaTabela({
  transactions,
  kategorie,
  osoby,
  onEdit,
  onUdzial,
  onDedupChange,
  onWyklucz,
}) {
  return (
    <div className="overflow-auto border border-gray-200 rounded-xl max-h-[60vh] max-w-full">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 z-[1]">
          <tr>
            <th className={`${naglowek} text-center`}><span className="sr-only">Zatwierdź</span>✓</th>
            <th className={naglowek}>Data</th>
            <th className={`${naglowek} text-right`}>Kwota</th>
            <th className={naglowek}>Opis</th>
            <th className={naglowek}>Kategoria</th>
            <th className={naglowek}>Podkategoria</th>
            <th className={naglowek}>Osoba</th>
            <th className={`${naglowek} text-center`}>Akcje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) => {
            const id = tx.dowodId;
            const udzial = tx._dedup?.udzial ?? '';
            return (
              <tr key={id} className={`hover:bg-gray-50/70 transition-colors ${
                tx._dedup?.wybrana === false
                  ? 'opacity-60'
                  : tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane'
                  ? 'bg-amber-50/40'
                  : ''
              }`}>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={tx._dedup?.wybrana !== false}
                    onChange={e => onDedupChange(id, { wybrana: e.target.checked })}
                    aria-label={`Zatwierdź operację z ${tx.data}: ${tx.opis || 'bez opisu'}`}
                    className="w-4 h-4 accent-indigo-600"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={tx.data}
                    onChange={e => onEdit(id, 'data', e.target.value)}
                    aria-label="Data transakcji"
                    className={`${pole} min-w-[130px]`}
                  />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <div className={`font-medium ${tx.typ === 'Wydatek' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatKwota(tx.kwota)} zł
                  </div>
                  {tx._dedup?.udzial && (
                    <div className="text-[11px] text-gray-400">z {formatKwota(Math.abs(tx._dowod.kwotaPelna))} zł</div>
                  )}
                  <select
                    value={udzial}
                    onChange={e => onUdzial(id, e.target.value)}
                    aria-label="Udział gospodarstwa"
                    className="mt-1 border border-gray-200 rounded-lg px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="">całość</option>
                    {[...new Set([...UDZIALY, udzial].filter(Boolean))].map(u => (
                      <option key={u} value={u}>udział {u}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 min-w-[200px]">
                  <input
                    type="text"
                    value={tx.opis}
                    onChange={e => onEdit(id, 'opis', e.target.value)}
                    aria-label="Opis"
                    className={pole}
                  />
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {tx._dowod.zrodlo}
                    {tx._dowod.kontrahent && <> · {tx._dowod.kontrahent}</>}
                  </div>
                  <DedupInfo dedup={tx._dedup} onChange={zmiany => onDedupChange(id, zmiany)} />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={tx.kategoria}
                    onChange={e => onEdit(id, 'kategoria', e.target.value)}
                    aria-label="Kategoria"
                    className={`${pole} min-w-[110px]`}
                  >
                    {!kategorie?.[tx.typ]?.[tx.kategoria] && <option value={tx.kategoria}>{tx.kategoria}</option>}
                    {Object.keys(kategorie?.[tx.typ] || {}).map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={tx.podkategoria}
                    onChange={e => onEdit(id, 'podkategoria', e.target.value)}
                    aria-label="Podkategoria"
                    className={`${pole} min-w-[120px]`}
                  >
                    <option value="">—</option>
                    {(kategorie?.[tx.typ]?.[tx.kategoria] || []).map(pk => (
                      <option key={pk} value={pk}>{pk}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={tx.osoba}
                    onChange={e => onEdit(id, 'osoba', e.target.value)}
                    aria-label="Osoba"
                    className={`${pole} min-w-[100px]`}
                  >
                    {!osoby.includes(tx.osoba) && <option value={tx.osoba}>{tx.osoba || '—'}</option>}
                    {osoby.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => onWyklucz(id)}
                    aria-label={`Wyklucz operację z ${tx.data}`}
                    title="Wyklucz z budżetu (transfer własny, zwrot…)"
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors whitespace-nowrap"
                  >
                    Wyklucz
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
