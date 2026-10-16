import Button from '../Button';

// Krok 2: mapowanie kolumn (formaty bankowe — automatycznie), wybór osoby
// i podgląd pierwszych wierszy pliku.
export default function MappingStep({
  detectedFormat,
  headers,
  columnMapping,
  onMappingChange,
  selectedOsoba,
  setSelectedOsoba,
  osoby,
  csvData,
  onBack,
  onNext,
}) {
  return (
      <div className="space-y-5">
        {detectedFormat === 'pko_bp' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-emerald-500 text-xl mt-0.5">✓</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Wykryto format PKO BP</p>
              <p className="text-xs text-emerald-600 mt-0.5">Kolumny zostały automatycznie zmapowane, a opisy wyodrębnione z danych bankowych.</p>
            </div>
          </div>
        )}
        {detectedFormat === 'millennium' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-emerald-500 text-xl mt-0.5">✓</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Wykryto format Bank Millennium</p>
              <p className="text-xs text-emerald-600 mt-0.5">Kolumny Obciążenia/Uznania zmapowane automatycznie. Opisy transakcji kartą oczyszczone z dat i kodów krajów.</p>
            </div>
          </div>
        )}
        {detectedFormat === 'revolut' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-emerald-500 text-xl mt-0.5">✓</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Wykryto format Revolut</p>
              <p className="text-xs text-emerald-600 mt-0.5">Pominięto operacje w toku i anulowane. Kwoty są w walucie konta — sprawdź przeliczenie przed importem.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { field: 'data', label: 'Data operacji', required: true },
            { field: 'kwota', label: 'Kwota / Obciążenia', required: true },
            { field: 'uznania', label: 'Uznania (wpływy)', required: false, hint: 'dla iPKO' },
            { field: 'opis', label: 'Opis / Notatka', required: false },
          ].map(({ field, label, required, hint }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {label}
                {required && <span className="text-rose-500 ml-1">*</span>}
                {hint && <span className="text-gray-400 font-normal ml-1 text-xs">— {hint}</span>}
              </label>
              <select
                value={columnMapping[field] || ''}
                onChange={e => onMappingChange(field, e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              >
                <option value="">{field === 'uznania' ? 'Brak (jedna kolumna kwoty)' : 'Wybierz kolumnę…'}</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Person selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Osoba <span className="text-rose-500">*</span>
          </label>
          <select
            value={selectedOsoba}
            onChange={e => setSelectedOsoba(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          >
            <option value="">— Wybierz osobę —</option>
            {osoby.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Data preview */}
        {csvData && csvData.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
              Podgląd danych — pierwsze 3 wiersze z {csvData.length}
            </div>
            <div className="overflow-auto max-h-40">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {headers.map(h => (
                      <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium text-gray-600 border-b border-gray-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      {headers.map(h => (
                        <td key={h} className="px-3 py-1.5 whitespace-nowrap max-w-[180px] truncate text-gray-500">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700 space-y-1">
          <p>Format daty: YYYY-MM-DD. Kwota ujemna = wydatek, dodatnia = przychód.</p>
          <p>iPKO: Zmapuj „Obciążenia" jako Kwota i „Uznania" jako Uznania.</p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onBack}>
            ← Wstecz
          </Button>
          <Button className="flex-1" onClick={onNext}>
            Dalej →
          </Button>
        </div>
      </div>
  );
}
