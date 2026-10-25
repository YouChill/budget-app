import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import * as api from '../services/api';
import ModalShell from './ModalShell';
import { logger } from '../utils/logger';
import { wczytajWiersze } from '../lib/csvImport/banki';
import { przygotujTransakcje } from '../lib/csvImport/przygotowanie';
import { pozycjeKolejki } from '../lib/csvImport/kolejka';
import StepIndicator from './csvImport/StepIndicator';
import UploadStep from './csvImport/UploadStep';
import MappingStep from './csvImport/MappingStep';
import SuccessStep from './csvImport/SuccessStep';

// Import wyciągu CSV w 3 krokach: plik → mapowanie kolumn + osoba → zapis do
// kolejki i podsumowanie (#131). Kategoryzacja dzieje się później, w widoku
// „Do rozliczenia" — kreator nic nie kategoryzuje i nic nie trzyma
// w localStorage. Logika parsowania i budowy pozycji: src/lib/csvImport/.
export default function CSVImport({ onClose, osoby = [], onSaved, onOpenKolejka }) {
  const [step, setStep] = useState(1);
  const [csvData, setCsvData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [columnMapping, setColumnMapping] = useState({
    data: null,
    kwota: null,
    uznania: null,
    opis: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [raport, setRaport] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState(null);
  const [selectedOsoba, setSelectedOsoba] = useState('');

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Krok 1: plik ──────────────────────────────────────────────────────────────

  const processFile = (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
      setError('Proszę wybrać plik CSV');
      return;
    }
    setSelectedFileName(file.name);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const wynik = wczytajWiersze(results);
        if (!wynik) {
          setError('Plik CSV jest pusty lub zawiera za mało danych');
          return;
        }
        setCsvData(wynik.csvData);
        setHeaders(wynik.headers);
        setDetectedFormat(wynik.detectedFormat);
        // Dowolny CSV: mapowanie zostaje ręczne (poprzedni wybór użytkownika).
        if (wynik.columnMapping) setColumnMapping(wynik.columnMapping);
        setStep(2);
      },
      error: (err) => setError(`Błąd parsowania CSV: ${err.message}`),
    });
  };

  // ── Krok 2 → 3: zapis do kolejki ──────────────────────────────────────────────

  const zapiszDoKolejki = async () => {
    if (!columnMapping.data || (!columnMapping.kwota && !columnMapping.uznania)) {
      setError('Musisz zmapować co najmniej kolumnę daty i kwoty');
      return;
    }
    if (!selectedOsoba) {
      setError('Musisz wybrać osobę przed przejściem dalej');
      return;
    }

    const { transakcje, pominiete } = przygotujTransakcje({ csvData, headers, columnMapping, kategorie: {} });
    if (transakcje.length === 0) {
      setError('Brak poprawnych wierszy do importu (sprawdź format daty: YYYY-MM-DD lub DD.MM.YYYY)');
      return;
    }

    setIsLoading(true);
    try {
      const aliasy = await api.getAliasyKontrahentow();
      const pozycje = await pozycjeKolejki(transakcje, {
        osoba: selectedOsoba,
        aliasy,
        hmacRachunkow: api.hmacRachunkow,
      });
      const wynik = await api.dodajDoKolejki(pozycje);
      setRaport({ ...wynik, bledneDaty: pominiete });
      setCsvData(null);
      setStep(3);
      if (onSaved) onSaved();
    } catch (err) {
      logger.error('CSVImport', 'zapis do kolejki nie powiódł się:', err);
      setError(err.brakMigracji
        ? 'Baza nie ma migracji kolejki importu — wdróż migracje i spróbuj ponownie'
        : err.message || 'Nie udało się zapisać wyciągu');
    } finally {
      setIsLoading(false);
    }
  };

  const przejdzDoRozliczenia = () => {
    onClose();
    if (onOpenKolejka) onOpenKolejka();
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <ModalShell onClose={onClose} labelId="csv-import-title" maxWidth="max-w-5xl" overlayTint="bg-black/60">

      {/* Header */}
      <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100 shrink-0">
        <div>
          <h2 id="csv-import-title" className="text-xl font-bold text-gray-900">Import z CSV</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {step === 1 && 'Wybierz plik do zaimportowania'}
            {step === 2 && 'Dopasuj kolumny do pól'}
            {step === 3 && 'Wyciąg zapisany w kolejce'}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Zamknij import CSV"
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl font-bold"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="p-6 overflow-auto flex-1">
        <StepIndicator current={step} />

        {/* Inline error */}
        {error && (
          <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-5 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Zamknij komunikat błędu" className="text-rose-400 hover:text-rose-600 ml-2 font-bold">&#10005;</button>
          </div>
        )}

        {step === 1 && (
          <UploadStep onFile={processFile} selectedFileName={selectedFileName} />
        )}

        {step === 2 && (
          <MappingStep
            detectedFormat={detectedFormat}
            headers={headers}
            columnMapping={columnMapping}
            onMappingChange={(field, value) => setColumnMapping(prev => ({ ...prev, [field]: value }))}
            selectedOsoba={selectedOsoba}
            setSelectedOsoba={setSelectedOsoba}
            osoby={osoby}
            csvData={csvData}
            isLoading={isLoading}
            onBack={() => { setStep(1); setDetectedFormat(null); }}
            onNext={zapiszDoKolejki}
          />
        )}

        {step === 3 && (
          <SuccessStep raport={raport} onClose={onClose} onOpenKolejka={przejdzDoRozliczenia} />
        )}
      </div>
    </ModalShell>
  );
}
