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

export default function CSVImport({ onClose, apiUrl, kategorie = {}, onSaved }) {
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

        return {
          data: row[columnMapping.data],
          kwota: parseFloat(row[columnMapping.kwota].toString().replace(/,/g, '.')),
          opis: opis,
          kategoria: categoryData?.kategoria || 'Inne',
          podkategoria: categoryData?.podkategoria || 'Nieprzewidziane',
          typ: parseFloat(row[columnMapping.kwota]) < 0 ? 'Wydatek' : 'Przychód',
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

    setIsLoading(true);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addTransakcjeBatch',
          transakcje: transactions
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setStep(4);
        if (onSaved) onSaved();
      } else {
        alert(data.error || 'Błąd importu');
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Błąd połączenia');
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-100 px-6 py-4 flex justify-between items-center border-b">
          <h2 className="text-xl font-bold">Import z CSV</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-bold text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
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
              <h3 className="font-semibold text-lg">
                Podgląd importu ({transactions.length} transakcji)
              </h3>
              
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
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
                            type="number"
                            value={tx.kwota}
                            onChange={(e) => handleEditTransaction(idx, 'kwota', parseFloat(e.target.value))}
                            className="border rounded px-2 py-1 w-full text-right"
                            step="0.01"
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
                  disabled={isLoading}
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
                onClick={onClose}
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
