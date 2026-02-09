import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

// Mapowanie słów kluczowych na kategorie
const categoryMapping = {
  // Jedzenie
  'biedronka': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'tesco': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'carrefour': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'makro': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'żabka': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'lidl': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'auchan': { kategoria: 'Jedzenie', podkategoria: 'Zakupy domowe' },
  'mc donald': { kategoria: 'Jedzenie', podkategoria: 'Restauracje/miasto' },
  'restauracja': { kategoria: 'Jedzenie', podkategoria: 'Restauracje/miasto' },
  'pizza': { kategoria: 'Jedzenie', podkategoria: 'Restauracje/miasto' },
  'kawa': { kategoria: 'Jedzenie', podkategoria: 'Kawa/przekąski' },
  'starbucks': { kategoria: 'Jedzenie', podkategoria: 'Kawa/przekąski' },

  // Transport
  'paliwo': { kategoria: 'Transport', podkategoria: 'Paliwo' },
  'bp': { kategoria: 'Transport', podkategoria: 'Paliwo' },
  'orlen': { kategoria: 'Transport', podkategoria: 'Paliwo' },
  'pkp': { kategoria: 'Transport', podkategoria: 'Komunikacja miejska' },
  'metro': { kategoria: 'Transport', podkategoria: 'Komunikacja miejska' },
  'uber': { kategoria: 'Transport', podkategoria: 'Komunikacja miejska' },

  // Mieszkanie
  'mieszkanie': { kategoria: 'Mieszkanie', podkategoria: 'Czynsz' },
  'czynsz': { kategoria: 'Mieszkanie', podkategoria: 'Czynsz' },
  'energa': { kategoria: 'Mieszkanie', podkategoria: 'Prąd' },
  'pge': { kategoria: 'Mieszkanie', podkategoria: 'Prąd' },
  'gaz': { kategoria: 'Mieszkanie', podkategoria: 'Gaz' },
  'woda': { kategoria: 'Mieszkanie', podkategoria: 'Woda' },
  'internet': { kategoria: 'Mieszkanie', podkategoria: 'Internet' },
  'telefon': { kategoria: 'Mieszkanie', podkategoria: 'Telefon' },

  // Zdrowie
  'apteka': { kategoria: 'Zdrowie', podkategoria: 'Leki' },
  'lekarz': { kategoria: 'Zdrowie', podkategoria: 'Lekarz' },
  'szpital': { kategoria: 'Zdrowie', podkategoria: 'Lekarz' },
  'dentyst': { kategoria: 'Zdrowie', podkategoria: 'Lekarz' },

  // Rozrywka
  'kino': { kategoria: 'Rozrywka', podkategoria: 'Kino/koncerty' },
  'spotify': { kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' },
  'netflix': { kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' },
  'hbo': { kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' },
  'amazon': { kategoria: 'Rozrywka', podkategoria: 'Subskrypcje' },

  // Ubrania
  'h&m': { kategoria: 'Ubrania', podkategoria: 'Dorośli' },
  'zara': { kategoria: 'Ubrania', podkategoria: 'Dorośli' },
  'c&a': { kategoria: 'Ubrania', podkategoria: 'Dorośli' },
  'odzież': { kategoria: 'Ubrania', podkategoria: 'Dorośli' },

  // Dom
  'leroy merlin': { kategoria: 'Dom', podkategoria: 'Wyposażenie' },
  'jysk': { kategoria: 'Dom', podkategoria: 'Wyposażenie' },
  'ceneo': { kategoria: 'Dom', podkategoria: 'Wyposażenie' },

  // Inne
  'fryzjer': { kategoria: 'Inne', podkategoria: 'Fryzjer/kosmetyki' },
  'salon': { kategoria: 'Inne', podkategoria: 'Fryzjer/kosmetyki' },
  'kosmetyk': { kategoria: 'Inne', podkategoria: 'Fryzjer/kosmetyki' },
  'prezent': { kategoria: 'Inne', podkategoria: 'Prezenty' },
};

const categorizeDescription = (description) => {
  if (!description) return null;

  const lowerDesc = description.toLowerCase();

  // Szukaj dokładnych dopasowań
  for (const [keyword, category] of Object.entries(categoryMapping)) {
    if (lowerDesc.includes(keyword)) {
      return category;
    }
  }

  return null;
};

const STORAGE_KEY = 'csv_import_progress';

// Check if JWT token is expired (with 60s buffer)
function checkTokenExpired(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    ));
    if (!payload || !payload.exp) return true;
    return Date.now() >= (payload.exp - 60) * 1000;
  } catch {
    return true;
  }
}

export default function CSVImport({ onClose, apiUrl, kategorie = {}, onSaved, authToken }) {
  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping, 3: Preview, 4: Success
  const [csvData, setCsvData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    data: null,
    kwota: null,
    opis: null,
  });
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [sessionError, setSessionError] = useState(false);

  // Restore saved progress from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const { timestamp, transactions: savedTx, step: savedStep } = parsed;
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && savedTx?.length > 0) {
          if (window.confirm('Znaleziono zapisany postęp importu CSV. Czy chcesz go przywrócić?')) {
            setTransactions(savedTx);
            setStep(savedStep || 3);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to restore CSV import progress:', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Auto-save transactions to localStorage during editing (step 3)
  useEffect(() => {
    if (step === 3 && transactions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          timestamp: Date.now(),
          transactions,
          step,
        }));
        setLastSaved(new Date());
      } catch (e) {
        console.error('Failed to save CSV import progress:', e);
      }
    }
  }, [transactions, step]);

  // Heartbeat - keep session alive during category mapping (step 3)
  useEffect(() => {
    if (step !== 3 || !apiUrl || !authToken) return;

    const heartbeat = setInterval(async () => {
      try {
        await fetch(apiUrl, {
          method: 'POST',
          body: JSON.stringify({ action: 'keepAlive', token: authToken }),
        });
      } catch (e) {
        console.error('Session heartbeat failed:', e);
      }
    }, 5 * 60 * 1000); // every 5 minutes

    return () => clearInterval(heartbeat);
  }, [step, apiUrl, authToken]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setCsvData(results.data);
          setHeaders(Object.keys(results.data[0]));
          setStep(2);
        }
      },
      error: (error) => {
        alert(`Błąd parsowania CSV: ${error.message}`);
      },
    });
  };

  const handleMappingChange = (field, selectedHeader) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: selectedHeader
    }));
  };

  const prepareTransactions = () => {
    if (!columnMapping.data || !columnMapping.kwota) {
      alert('Musisz zmapować co najmniej kolumnę daty i kwoty');
      return false;
    }

    const processed = csvData
      .filter(row => row[columnMapping.data] && row[columnMapping.kwota])
      .map(row => {
        const opis = columnMapping.opis ? row[columnMapping.opis] : '';
        const categoryData = categorizeDescription(opis);
        const kwotaNum = parseFloat(row[columnMapping.kwota].toString().replace(/,/g, '.'));

        return {
          data: row[columnMapping.data],
          kwota: kwotaNum,
          opis: opis,
          kategoria: categoryData?.kategoria || 'Inne',
          podkategoria: categoryData?.podkategoria || 'Nieprzewidziane',
          typ: kwotaNum < 0 ? 'Wydatek' : 'Przychód',
        };
      });

    setTransactions(processed);
    setStep(3);
    return true;
  };

  const handleImport = async () => {
    if (transactions.length === 0) {
      alert('Brak transakcji do importu');
      return;
    }

    // Check token validity before attempting import
    if (checkTokenExpired(authToken)) {
      setSessionError(true);
      return;
    }

    setIsLoading(true);
    try {
      // Normalize kwota to numbers and update typ based on final amount
      const normalizedTransactions = transactions.map(tx => {
        const kwota = typeof tx.kwota === 'string'
          ? parseFloat(tx.kwota.replace(',', '.')) || 0
          : (tx.kwota || 0);
        return {
          ...tx,
          kwota,
          typ: kwota < 0 ? 'Wydatek' : 'Przychód',
        };
      });

      const res = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addTransakcjeBatch',
          transakcje: normalizedTransactions,
          token: authToken
        })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.removeItem(STORAGE_KEY);
        setStep(4);
        if (onSaved) onSaved();
      } else if (data.error && (data.error.toLowerCase().includes('token') || data.error.toLowerCase().includes('auth') || data.error.toLowerCase().includes('unauthorized'))) {
        setSessionError(true);
        setIsLoading(false);
      } else {
        alert(data.error || 'Błąd importu');
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Błąd połączenia. Twój postęp został zapisany lokalnie.');
      setIsLoading(false);
    }
  };

  const handleEditTransaction = (index, field, value) => {
    const updated = [...transactions];
    updated[index][field] = value;
    setTransactions(updated);
  };

  const handleDeleteTransaction = (index) => {
    setTransactions(transactions.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (step === 4) {
      localStorage.removeItem(STORAGE_KEY);
    }
    onClose();
  };

  const handleRelogin = () => {
    // Progress is already saved in localStorage; redirect to re-authenticate
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header - z-10 ensures it stays above table headers and edit buttons */}
        <div className="sticky top-0 bg-gray-100 px-6 py-4 flex justify-between items-center border-b z-10">
          <h2 className="text-xl font-bold">Import z CSV</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 font-bold text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Session expired error */}
          {sessionError && (
            <div className="mb-4 bg-red-50 border border-red-300 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 mb-1">Sesja wygasła</h4>
              <p className="text-sm text-red-700 mb-3">
                Twoja sesja wygasła, ale postęp został zapisany lokalnie.
                Zaloguj się ponownie, aby kontynuować import.
              </p>
              <button
                onClick={handleRelogin}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Zaloguj ponownie
              </button>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
                <p className="text-gray-700 mb-4">Przeciągnij plik CSV lub kliknij aby wybrać</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block mx-auto"
                />
              </div>
              <p className="text-sm text-gray-600">
                Obsługiwane formaty: CSV z nagłówkami kolumn
              </p>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Mapowanie kolumn</h3>
              <p className="text-gray-600">Wskaż które kolumny zawierają jakie dane</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Data operacji *</label>
                  <select
                    value={columnMapping.data || ''}
                    onChange={(e) => handleMappingChange('data', e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Kwota *</label>
                  <select
                    value={columnMapping.kwota || ''}
                    onChange={(e) => handleMappingChange('kwota', e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Opis/Notatka</label>
                  <select
                    value={columnMapping.opis || ''}
                    onChange={(e) => handleMappingChange('opis', e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-sm text-yellow-800">
                  💡 Format daty: YYYY-MM-DD. Kwota ujemna = wydatek, dodatnia = przychód
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Wstecz
                </button>
                <button
                  onClick={prepareTransactions}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Dalej
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  Podgląd importu ({transactions.length} transakcji)
                </h3>
                {lastSaved && (
                  <span className="text-xs text-gray-400">
                    Auto-zapis: {lastSaved.toLocaleTimeString('pl-PL')}
                  </span>
                )}
              </div>

              {/* Table wrapper with its own scroll context so thead sticks within it */}
              <div className="overflow-auto border rounded max-h-[55vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0 z-[1]">
                    <tr>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-right">Kwota</th>
                      <th className="px-4 py-2 text-left">Opis</th>
                      <th className="px-4 py-2 text-left">Kategoria</th>
                      <th className="px-4 py-2 text-left">Podkategoria</th>
                      <th className="px-4 py-2 text-center">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={tx.data}
                            onChange={(e) => handleEditTransaction(idx, 'data', e.target.value)}
                            className="border rounded px-2 py-1 w-full"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={tx.kwota}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const normalized = raw.replace(',', '.');
                              // Allow empty, minus sign alone, or valid decimal number pattern
                              if (normalized === '' || normalized === '-' || /^-?\d*\.?\d*$/.test(normalized)) {
                                handleEditTransaction(idx, 'kwota', normalized);
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value.toString().replace(',', '.'));
                              handleEditTransaction(idx, 'kwota', isNaN(val) ? 0 : val);
                            }}
                            className="border rounded px-2 py-1 w-full text-right"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={tx.opis}
                            onChange={(e) => handleEditTransaction(idx, 'opis', e.target.value)}
                            className="border rounded px-2 py-1 w-full text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={tx.kategoria}
                            onChange={(e) => handleEditTransaction(idx, 'kategoria', e.target.value)}
                            className="border rounded px-2 py-1 w-full text-sm"
                          >
                            {Object.keys(kategorie?.Wydatek || {}).map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={tx.podkategoria}
                            onChange={(e) => handleEditTransaction(idx, 'podkategoria', e.target.value)}
                            className="border rounded px-2 py-1 w-full text-sm"
                          >
                            {(kategorie?.Wydatek?.[tx.kategoria] || []).map(pk => (
                              <option key={pk} value={pk}>{pk}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleDeleteTransaction(idx)}
                            className="text-red-600 hover:text-red-800 font-bold"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Wstecz
                </button>
                <button
                  onClick={handleImport}
                  disabled={isLoading || sessionError}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? 'Importuję...' : 'Importuj transakcje'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center space-y-4">
              <div className="text-5xl">✓</div>
              <h3 className="font-semibold text-lg text-green-600">
                Import zakończony pomyślnie!
              </h3>
              <p className="text-gray-600">
                Zaimportowano {transactions.length} transakcji
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Zamknij
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
