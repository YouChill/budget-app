import { useCallback, useEffect, useState } from 'react';
import Papa from 'papaparse';
import * as api from '../services/api';
import * as categoryAI from '../services/categoryAI';
import ModalShell from './ModalShell';
import ConfirmDialog from './ConfirmDialog';
import { logger } from '../utils/logger';
import { wczytajWiersze } from '../lib/csvImport/banki';
import { zastosujRegule } from '../lib/csvImport/kategoryzacja';
import {
  przygotujTransakcje,
  rekordyImportu,
  edytujPole,
  usunZMeta,
  liczStatusy,
  bezKategorii,
} from '../lib/csvImport/przygotowanie';
import { oznaczZaksiegowane } from '../lib/csvImport/zaksiegowane';
import StepIndicator from './csvImport/StepIndicator';
import UploadStep from './csvImport/UploadStep';
import MappingStep from './csvImport/MappingStep';
import PreviewStep from './csvImport/PreviewStep';
import SuccessStep from './csvImport/SuccessStep';
import { useRecognitionRules } from './csvImport/useRecognitionRules';
import { useImportProgress } from './csvImport/useImportProgress';
import { useAiCategorization } from './csvImport/useAiCategorization';

// Import wyciągu CSV w 4 krokach: plik → mapowanie kolumn → podgląd/edycja
// (z rozpoznawaniem już zaksięgowanych) → podsumowanie. Logika parsowania,
// kategoryzacji i budowy rekordów: src/lib/csvImport/.
export default function CSVImport({ onClose, kategorie = {}, osoby = [], onSaved }) {
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
  const [transactions, setTransactions] = useState([]);
  const [txMeta, setTxMeta] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // { dostepny: bool, powod?: 'migracja' | 'blad' } — czy rozpoznawanie
  // zaksięgowanych zadziałało; null przed krokiem 3.
  const [dedupInfo, setDedupInfo] = useState(null);
  const [importRaport, setImportRaport] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState(null);
  const [selectedOsoba, setSelectedOsoba] = useState('');
  const [ruleNotification, setRuleNotification] = useState(null);

  const aiEnabled = categoryAI.isAIEnabled();
  const { rules, addRule, deleteRule } = useRecognitionRules();
  const { lastSaved, restorePrompt, takeRestore, discardRestore, clearProgress } =
    useImportProgress({ step, transactions, txMeta, dedupInfo, selectedOsoba });
  const { aiLoading, aiMatchCount } =
    useAiCategorization({ step, aiEnabled, transactions, setTransactions, kategorie });

  useEffect(() => {
    if (!ruleNotification) return;
    const t = setTimeout(() => setRuleNotification(null), 4000);
    return () => clearTimeout(t);
  }, [ruleNotification]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const handleRestoreProgress = () => {
    const { savedTx, savedMeta, savedStep, savedDedup, savedOsoba } = takeRestore();
    setTransactions(savedTx);
    if (savedMeta) setTxMeta(savedMeta);
    setDedupInfo(savedDedup ?? null);
    if (savedOsoba) setSelectedOsoba(savedOsoba);
    setStep(savedStep || 3);
  };

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

  // ── Krok 2 → 3: przygotowanie transakcji ──────────────────────────────────────

  const prepareTransactions = async () => {
    if (!columnMapping.data || (!columnMapping.kwota && !columnMapping.uznania)) {
      setError('Musisz zmapować co najmniej kolumnę daty i kwoty');
      return false;
    }
    if (!selectedOsoba) {
      setError('Musisz wybrać osobę przed przejściem dalej');
      return false;
    }

    const { transakcje, meta, pominiete } =
      przygotujTransakcje({ csvData, headers, columnMapping, rules, kategorie });

    if (transakcje.length === 0) {
      setError('Brak poprawnych wierszy do importu (sprawdź format daty: YYYY-MM-DD lub DD.MM.YYYY)');
      return false;
    }
    if (pominiete > 0) {
      setError(`Pominięto ${pominiete} ${pominiete === 1 ? 'wiersz' : 'wierszy'} z nieprawidłową datą.`);
    }

    setIsLoading(true);
    let oznaczone = transakcje;
    try {
      const wynik = await oznaczZaksiegowane(transakcje, kategorie);
      oznaczone = wynik.lista;
      setDedupInfo(wynik.dedupInfo);
    } finally {
      setIsLoading(false);
    }

    setTransactions(oznaczone);
    setTxMeta(meta);
    setCsvData(null);
    setStep(3);
    return true;
  };

  // ── Krok 3: reguły i edycja ───────────────────────────────────────────────────

  // Zwraca true, gdy reguła została dodana (formularz może się wyczyścić).
  const handleAddRule = ({ keyword, kategoria, podkategoria, typ }) => {
    if (!keyword.trim()) { setError('Podaj warunek (tekst do wyszukania)'); return false; }
    if (!kategoria) { setError('Wybierz kategorię'); return false; }

    const newRule = { keyword: keyword.trim(), kategoria, podkategoria: podkategoria || '', typ, createdAt: Date.now() };
    addRule(newRule);

    // Save to Supabase vector store (non-blocking)
    if (aiEnabled) {
      categoryAI.saveCategoryRule(keyword.trim(), kategoria, podkategoria, 'manual')
        .catch(err => logger.error('CSVImport', 'saveCategoryRule failed:', err));
    }

    const { updated, matchCount } = zastosujRegule(newRule, transactions);
    setTransactions(updated);
    setRuleNotification({ keyword: newRule.keyword, kategoria, podkategoria, matchCount });
    return true;
  };

  // Wybór wiersza i akcja dla możliwego duplikatu wpisu ręcznego.
  const handleDedupChange = useCallback((index, zmiany) => {
    setTransactions(prev => prev.map((tx, i) =>
      i === index && tx._dedup ? { ...tx, _dedup: { ...tx._dedup, ...zmiany } } : tx
    ));
  }, []);

  const handleEditTransaction = useCallback((index, field, value) => {
    setTransactions(prev => prev.map((tx, i) => (i === index ? edytujPole(tx, field, value) : tx)));
  }, []);

  const handleDeleteTransaction = (index) => {
    setTransactions(prev => prev.filter((_, i) => i !== index));
    setTxMeta(prev => usunZMeta(prev, index));
  };

  // ── Krok 3 → 4: import ────────────────────────────────────────────────────────

  const handleImport = async () => {
    const doImportu = transactions.filter(tx => tx._dedup?.wybrana !== false);
    if (doImportu.length === 0) { setError('Brak zaznaczonych transakcji do importu'); return; }

    setIsLoading(true);
    try {
      // tx.kwota jest już liczbą (z przygotowania lub onBlur); parseKwota
      // przepuszcza liczby bez zmian, więc nie psuje wartości typu 1.234.
      const rekordy = rekordyImportu(transactions, selectedOsoba);
      let raport;
      if (dedupInfo?.dostepny) {
        raport = await api.importujTransakcje(rekordy);
      } else {
        // Baza bez migracji 014 albo nieudane sprawdzenie — stara ścieżka,
        // bez ochrony przed podwójnym importem (podgląd o tym ostrzegał).
        const data = await api.addTransakcjeBatch(rekordy.map(r => ({ ...r, opis: r.komentarz })));
        raport = { success: data.success, dodane: data.count, pominiete: 0, polaczone: 0, dolaczone: 0 };
      }

      if (raport.success) {
        clearProgress();
        setImportRaport(raport);
        setStep(4);
        if (onSaved) onSaved();

        // Save AI category rules in background (non-blocking)
        if (aiEnabled) {
          categoryAI.saveCategoryRulesBatch(rekordy.map(r => ({ ...r, opis: r.komentarz })))
            .catch(err => logger.error('CSVImport', 'saveCategoryRulesBatch failed:', err));
        }
      }
    } catch (err) {
      logger.error('CSVImport', 'handleImport failed:', err);
      setError(err.message || 'Błąd importu. Twój postęp został zapisany lokalnie.');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (step === 4) clearProgress();
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <ModalShell onClose={handleClose} labelId="csv-import-title" maxWidth="max-w-5xl" overlayTint="bg-black/60">

        {/* Header */}
        <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100 shrink-0">
          <div>
            <h2 id="csv-import-title" className="text-xl font-bold text-gray-900">Import z CSV</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 1 && 'Wybierz plik do zaimportowania'}
              {step === 2 && 'Dopasuj kolumny do pól'}
              {step === 3 && `${transactions.length} transakcji do przejrzenia`}
              {step === 4 && 'Import zakończony'}
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Zamknij import CSV"
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto flex-1">

          {/* Step indicator */}
          {step < 4 && <StepIndicator current={step} />}

          {/* Inline error */}
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-5 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} aria-label="Zamknij komunikat błędu" className="text-rose-400 hover:text-rose-600 ml-2 font-bold">&#10005;</button>
            </div>
          )}

          {step === 1 && (
            <UploadStep onFile={processFile} selectedFileName={selectedFileName} aiEnabled={aiEnabled} />
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
              onBack={() => { setStep(1); setDetectedFormat(null); }}
              onNext={prepareTransactions}
            />
          )}

          {step === 3 && (
            <PreviewStep
              transactions={transactions}
              txMeta={txMeta}
              kategorie={kategorie}
              aiEnabled={aiEnabled}
              aiLoading={aiLoading}
              aiMatchCount={aiMatchCount}
              unmappedCount={transactions.filter(bezKategorii).length}
              lastSaved={lastSaved}
              ruleNotification={ruleNotification}
              onDismissRuleNotification={() => setRuleNotification(null)}
              dedupInfo={dedupInfo}
              liczbyStatusow={liczStatusy(transactions)}
              liczbaDoImportu={transactions.filter(tx => tx._dedup?.wybrana !== false).length}
              isLoading={isLoading}
              rules={rules}
              onAddRule={handleAddRule}
              onDeleteRule={deleteRule}
              onEdit={handleEditTransaction}
              onDedupChange={handleDedupChange}
              onDelete={handleDeleteTransaction}
              onBack={() => setStep(2)}
              onImport={handleImport}
            />
          )}

          {step === 4 && (
            <SuccessStep importRaport={importRaport} aiEnabled={aiEnabled} onClose={handleClose} />
          )}
        </div>
      </ModalShell>

      {/* Dialog przywracania zapisanego postępu */}
      {restorePrompt && (
        <ConfirmDialog
          title="Przywrócić zapisany postęp?"
          message={`Znaleziono zapisany postęp importu CSV (${restorePrompt.savedTx.length} transakcji). Możesz kontynuować od miejsca, w którym skończono.`}
          confirmLabel="Przywróć"
          cancelLabel="Odrzuć"
          onConfirm={handleRestoreProgress}
          onCancel={discardRestore}
        />
      )}
    </>
  );
}
