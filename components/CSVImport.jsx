import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import * as api from '../src/services/api';

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

const categorizeDescription = (description, userRules = []) => {
  if (!description) return null;

  const lowerDesc = description.toLowerCase();

  // Najpierw sprawdź reguły użytkownika (mają priorytet)
  for (const rule of userRules) {
    if (lowerDesc.includes(rule.keyword.toLowerCase())) {
      return { kategoria: rule.kategoria, podkategoria: rule.podkategoria };
    }
  }

  // Potem szukaj w domyślnym mapowaniu
  for (const [keyword, category] of Object.entries(categoryMapping)) {
    if (lowerDesc.includes(keyword)) {
      return category;
    }
  }

  return null;
};

// C2: Walidacja kategorii z categoryMapping względem prop kategorie
const validateCategoryExists = (kategoria, podkategoria, kategorieProp, typ) => {
  const catExists = kategorieProp?.[typ]?.[kategoria];
  if (!catExists) return { kategoria: 'Inne', podkategoria: 'Nieprzewidziane' };
  const subExists = catExists.includes(podkategoria);
  return { kategoria, podkategoria: subExists ? podkategoria : '' };
};

const STORAGE_KEY = 'csv_import_progress';
const RULES_STORAGE_KEY = 'csv_recognition_rules';


// Wykrywanie formatu PKO BP: pierwszy wiersz ma nagłówki "Data operacji", "Kwota", itp.
// a kolumny 7-11 zawierają dane w formacie "Klucz: wartość" bez nagłówków
const detectPkoBpFormat = (firstRow) => {
  if (!firstRow || !Array.isArray(firstRow) || firstRow.length < 7) return false;
  // Sprawdź czy pierwsze kolumny pasują do nagłówków PKO BP
  return firstRow[0]?.trim() === 'Data operacji' &&
    firstRow[3]?.trim() === 'Kwota' &&
    firstRow[6]?.trim() === 'Opis transakcji';
};

// Ekstrakcja czytelnego opisu z formatu PKO BP
// Kolumny 7-11 zawierają dane jak: "Tytuł: ...", "Lokalizacja: Adres: ... Miasto: ...", "Rachunek odbiorcy: ...", "Nazwa odbiorcy: ..."
const extractPkoBpDescription = (row) => {
  // Zbierz wszystkie kolumny od indeksu 6 (Opis transakcji) do końca
  const extraCols = row.slice(6).filter(v => v && v.trim());

  // Szukaj nazwy z "Lokalizacja: Adres:" - najczęściej zawiera nazwę sklepu
  let locationName = null;
  let locationCity = null;
  for (const col of extraCols) {
    const locMatch = col.match(/Lokalizacja:\s*Adres:\s*(.+?)(?:\s+Miasto:\s*(.+?))?(?:\s+Kraj:|$)/i);
    if (locMatch) {
      locationName = locMatch[1]?.trim();
      locationCity = locMatch[2]?.trim();
    }
  }

  // Szukaj tytułu z "Tytuł:" - w przelewach zawiera treść przelewu
  let tytul = null;
  for (const col of extraCols) {
    const tytulMatch = col.match(/Tytuł:\s*(.+)/i);
    if (tytulMatch) {
      tytul = tytulMatch[1].trim();
    }
  }

  // Szukaj nazwy odbiorcy/nadawcy
  let nazwaOdbiorcy = null;
  for (const col of extraCols) {
    const nameMatch = col.match(/Nazwa (?:odbiorcy|nadawcy):\s*(.+)/i);
    if (nameMatch) {
      nazwaOdbiorcy = nameMatch[1].trim();
    }
  }

  // Logika budowania opisu:
  // 1. Dla płatności kartą - nazwa sklepu z lokalizacji jest najlepsza
  // 2. Dla przelewów - tytuł przelewu + nazwa odbiorcy/nadawcy
  // 3. Fallback - co jest dostępne

  // Sprawdź czy tytuł to tylko numer (bezużyteczny dla opisu)
  const tytulIsNumeric = tytul && /^[\d\s/]+$/.test(tytul);
  // Tytuł z treścią użyteczną (nie sam numer)
  const tytulUseful = tytul && !tytulIsNumeric;

  // Oczyść tytuł przelewu na telefon z numerów
  let cleanTytul = tytul;
  if (tytulUseful && cleanTytul) {
    // Usuń "OD: 48... DO: 48..." z końca tytułu przelewu na telefon
    cleanTytul = cleanTytul.replace(/\s*OD:\s*\d+\s*DO:\s*[\d*]+\s*$/, '').trim();
    // Usuń numery referencyjne z początku np. "000498849 74230786050185220377112"
    cleanTytul = cleanTytul.replace(/^\d{6,}\s+\d{10,}\s*/, '').trim();
  }

  if (locationName) {
    // Płatność kartą - użyj nazwy sklepu
    const cityPart = locationCity ? `, ${locationCity}` : '';
    return locationName + cityPart;
  }

  if (tytulUseful && nazwaOdbiorcy) {
    // Przelew - tytuł + odbiorca
    return `${cleanTytul} - ${nazwaOdbiorcy}`;
  }

  if (tytulUseful) {
    return cleanTytul;
  }

  if (nazwaOdbiorcy) {
    return nazwaOdbiorcy;
  }

  // Fallback - zwróć pierwszą niepustą kolumnę dodatkową
  return extraCols[0] || '';
};

export default function CSVImport({ onClose, kategorie = {}, osoby = [], onSaved }) {
  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping, 3: Preview, 4: Success
  const [csvData, setCsvData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [detectedFormat, setDetectedFormat] = useState(null); // 'pko_bp' | null
  const [columnMapping, setColumnMapping] = useState({
    data: null,
    kwota: null,
    uznania: null, // iPKO: osobna kolumna dla wpływów (Uznania)
    opis: null,
  });
  const [transactions, setTransactions] = useState([]);
  const [txMeta, setTxMeta] = useState({}); // C3: { index: { _csvRaw, _originalOpis } }
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null); // D3: inline error state

  // A: Osoba selector
  const [selectedOsoba, setSelectedOsoba] = useState('');

  // Feature 6: Recognition rules
  const [recognitionRules, setRecognitionRules] = useState([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({ keyword: '', kategoria: '', podkategoria: '', typ: 'Wydatek' });
  const [ruleNotification, setRuleNotification] = useState(null);
  const [showRulesList, setShowRulesList] = useState(false);

  // Feature 7: Additional details column
  const [showDetailsColumn, setShowDetailsColumn] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Load recognition rules from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RULES_STORAGE_KEY);
      if (saved) {
        setRecognitionRules(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load recognition rules:', e);
    }
  }, []);

  // Restore saved progress from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const { timestamp, transactions: savedTx, txMeta: savedMeta, step: savedStep } = parsed;
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && savedTx?.length > 0) {
          if (window.confirm('Znaleziono zapisany postęp importu CSV. Czy chcesz go przywrócić?')) {
            setTransactions(savedTx);
            if (savedMeta) setTxMeta(savedMeta);
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
          txMeta,
          step,
        }));
        setLastSaved(new Date());
      } catch (e) {
        console.error('Failed to save CSV import progress:', e);
      }
    }
  }, [transactions, txMeta, step]);

  // Auto-dismiss rule notification after 4 seconds
  useEffect(() => {
    if (!ruleNotification) return;
    const timer = setTimeout(() => setRuleNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [ruleNotification]);

  // D3: Auto-dismiss error after 6 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Parsuj najpierw bez nagłówków, aby wykryć format
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length < 2) {
          setError('Plik CSV jest pusty lub zawiera za mało danych');
          return;
        }

        const firstRow = results.data[0];

        if (detectPkoBpFormat(firstRow)) {
          // Format PKO BP wykryty - przetwórz dane specjalnie
          const dataRows = results.data.slice(1); // Pomiń wiersz nagłówkowy
          // Przetwórz na obiekty z wygenerowanym opisem
          const processed = dataRows.map(row => ({
            'Data operacji': row[0] || '',
            'Data waluty': row[1] || '',
            'Typ transakcji': row[2] || '',
            'Kwota': row[3] || '',
            'Waluta': row[4] || '',
            'Saldo po transakcji': row[5] || '',
            'Opis (wyodrębniony)': extractPkoBpDescription(row),
            'Opis oryginalny': row.slice(6).filter(v => v && v.trim()).join(' | '),
          }));

          setCsvData(processed);
          setHeaders(['Data operacji', 'Data waluty', 'Typ transakcji', 'Kwota', 'Waluta', 'Saldo po transakcji', 'Opis (wyodrębniony)', 'Opis oryginalny']);
          setDetectedFormat('pko_bp');
          // Auto-mapowanie kolumn dla PKO BP
          setColumnMapping({
            data: 'Data operacji',
            kwota: 'Kwota',
            uznania: null,
            opis: 'Opis (wyodrębniony)',
          });
          setStep(2);
        } else {
          // Sprawdź czy pierwszy wiersz wygląda na nagłówki
          // Heurystyka: nagłówki to zwykle tekst, a dane zawierają liczby/daty
          const looksLikeHeaders = firstRow.some(cell =>
            typeof cell === 'string' && cell.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(cell.trim()) && !/^[+-]?\d+([.,]\d+)?$/.test(cell.trim())
          );

          if (looksLikeHeaders) {
            // Standardowe CSV z nagłówkami - ponowne parsowanie z header: true
            const headerRow = firstRow;
            const dataRows = results.data.slice(1);
            const processed = dataRows.map(row => {
              const obj = {};
              headerRow.forEach((h, i) => {
                const key = h?.trim() || `Kolumna ${i + 1}`;
                obj[key] = row[i] || '';
              });
              return obj;
            });
            setCsvData(processed);
            setHeaders(headerRow.map((h, i) => h?.trim() || `Kolumna ${i + 1}`));
            setDetectedFormat(null);
            setStep(2);
          } else {
            // CSV bez nagłówków - generuj nazwy kolumn
            const colCount = firstRow.length;
            const generatedHeaders = firstRow.map((_, i) => `Kolumna ${i + 1}`);
            const processed = results.data.map(row => {
              const obj = {};
              generatedHeaders.forEach((h, i) => {
                obj[h] = row[i] || '';
              });
              return obj;
            });
            setCsvData(processed);
            setHeaders(generatedHeaders);
            setDetectedFormat(null);
            setStep(2);
          }
        }
      },
      error: (err) => {
        setError(`Błąd parsowania CSV: ${err.message}`);
      },
    });
  };

  const handleMappingChange = (field, selectedHeader) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: selectedHeader
    }));
  };

  // D2: parseKwota z obsługą formatu bankowego PL (1 234,56)
  const parseKwota = (kwotaStr) => {
    if (!kwotaStr) return 0;
    let str = kwotaStr.toString().trim();
    // Usuń separatory tysięcy (spacja, nbsp)
    str = str.replace(/[\s\u00A0]/g, '');
    // Format europejski: "1.234,56" → "1234.56"
    if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(',', '.');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const prepareTransactions = () => {
    if (!columnMapping.data || (!columnMapping.kwota && !columnMapping.uznania)) {
      setError('Musisz zmapować co najmniej kolumnę daty i kwoty (lub Obciążenia + Uznania)');
      return false;
    }

    // A: Walidacja osoby
    if (!selectedOsoba) {
      setError('Musisz wybrać osobę przed przejściem dalej');
      return false;
    }

    const meta = {};
    const hasSplitColumns = columnMapping.uznania;
    const processed = csvData
      .filter(row => {
        if (!row[columnMapping.data]) return false;
        if (hasSplitColumns) {
          // iPKO: wiersz jest poprawny gdy ma wartość w Obciążenia LUB Uznania
          const hasDebit = columnMapping.kwota && row[columnMapping.kwota]?.toString().trim();
          const hasCredit = row[columnMapping.uznania]?.toString().trim();
          return hasDebit || hasCredit;
        }
        return row[columnMapping.kwota];
      })
      .map((row, idx) => {
        const opis = columnMapping.opis ? row[columnMapping.opis] : '';
        let kwotaNum;
        if (hasSplitColumns) {
          // iPKO: Obciążenia (ujemne) i Uznania (dodatnie) - użyj tego, co jest niepuste
          const debitStr = columnMapping.kwota ? row[columnMapping.kwota]?.toString().trim() : '';
          const creditStr = row[columnMapping.uznania]?.toString().trim() || '';
          if (creditStr) {
            kwotaNum = Math.abs(parseKwota(creditStr)); // uznania zawsze dodatnie
          } else {
            kwotaNum = parseKwota(debitStr); // obciążenia - zwykle ujemne
          }
        } else {
          kwotaNum = parseKwota(row[columnMapping.kwota]);
        }
        const typ = kwotaNum < 0 ? 'Wydatek' : 'Przychód';

        // C2: Kategoryzacja z walidacją
        const categoryData = categorizeDescription(opis, recognitionRules);
        const rawKategoria = categoryData?.kategoria || 'Inne';
        const rawPodkategoria = categoryData?.podkategoria || 'Nieprzewidziane';
        const validated = validateCategoryExists(rawKategoria, rawPodkategoria, kategorie, typ);

        // C3: Metadata do osobnego obiektu
        const csvRawFields = {};
        for (const [key, value] of Object.entries(row)) {
          if (key !== columnMapping.data && key !== columnMapping.kwota && key !== columnMapping.opis) {
            csvRawFields[key] = value;
          }
        }
        meta[idx] = { _originalOpis: opis, _csvRaw: csvRawFields };

        return {
          data: row[columnMapping.data],
          kwota: kwotaNum,
          opis: opis,
          kategoria: validated.kategoria,
          podkategoria: validated.podkategoria,
          typ,
        };
      });

    setTransactions(processed);
    setTxMeta(meta);
    // D4: Wyczyść csvData po przetworzeniu
    setCsvData(null);
    setStep(3);
    return true;
  };

  // Feature 6: Apply a single rule to unmapped transactions
  const applyRuleToTransactions = useCallback((rule, currentTransactions) => {
    const keyword = rule.keyword.toLowerCase();
    let matchCount = 0;

    const updated = currentTransactions.map(tx => {
      const isUnmapped = tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane';
      if (!isUnmapped) return tx;

      const lowerOpis = (tx.opis || '').toLowerCase();
      if (lowerOpis.includes(keyword)) {
        matchCount++;
        return {
          ...tx,
          kategoria: rule.kategoria,
          podkategoria: rule.podkategoria || '',
        };
      }
      return tx;
    });

    return { updated, matchCount };
  }, []);

  // Feature 6: Handle adding a new recognition rule
  const handleAddRule = () => {
    const { keyword, kategoria, podkategoria } = ruleForm;
    if (!keyword.trim()) {
      setError('Podaj warunek (tekst do wyszukania)');
      return;
    }
    if (!kategoria) {
      setError('Wybierz kategorię');
      return;
    }

    const newRule = {
      keyword: keyword.trim(),
      kategoria,
      podkategoria: podkategoria || '',
      createdAt: Date.now(),
    };

    // Save rule to list
    const updatedRules = [...recognitionRules, newRule];
    setRecognitionRules(updatedRules);
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(updatedRules));
    } catch (e) {
      console.error('Failed to save recognition rules:', e);
    }

    // Apply rule to current transactions
    const { updated, matchCount } = applyRuleToTransactions(newRule, transactions);
    setTransactions(updated);

    // Show notification
    setRuleNotification({
      keyword: newRule.keyword,
      kategoria: newRule.kategoria,
      podkategoria: newRule.podkategoria,
      matchCount,
    });

    // Reset form
    setRuleForm({ keyword: '', kategoria: '', podkategoria: '', typ: 'Wydatek' });
    setShowRuleForm(false);
  };

  // Feature 6: Delete a recognition rule
  const handleDeleteRule = (index) => {
    const updatedRules = recognitionRules.filter((_, i) => i !== index);
    setRecognitionRules(updatedRules);
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(updatedRules));
    } catch (e) {
      console.error('Failed to save recognition rules:', e);
    }
  };

  const handleImport = async () => {
    if (transactions.length === 0) {
      setError('Brak transakcji do importu');
      return;
    }

    setIsLoading(true);
    try {
      // C3: transactions[] nie zawierają już metadanych — wysyłamy bezpośrednio
      // A: Dodaj pole osoba do każdej transakcji
      const normalizedTransactions = transactions.map(tx => {
        const kwota = parseKwota(tx.kwota);
        return {
          data: tx.data,
          kwota,
          opis: tx.opis,
          kategoria: tx.kategoria,
          podkategoria: tx.podkategoria,
          typ: kwota < 0 ? 'Wydatek' : 'Przychód',
          osoba: selectedOsoba,
        };
      });

      const data = await api.addTransakcjeBatch(normalizedTransactions);

      if (data.success) {
        localStorage.removeItem(STORAGE_KEY);
        setStep(4);
        if (onSaved) onSaved();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Błąd importu. Twój postęp został zapisany lokalnie.');
      setIsLoading(false);
    }
  };

  // D1: Immutable update
  const handleEditTransaction = useCallback((index, field, value) => {
    setTransactions(prev => prev.map((tx, i) =>
      i === index ? { ...tx, [field]: value } : tx
    ));
  }, []);

  const handleDeleteTransaction = (index) => {
    setTransactions(prev => prev.filter((_, i) => i !== index));
    // C3: Cleanup metadata for deleted index and re-index
    setTxMeta(prev => {
      const next = {};
      let newIdx = 0;
      for (let i = 0; i < Object.keys(prev).length + 1; i++) {
        if (i === index) continue;
        if (prev[i]) {
          next[newIdx] = prev[i];
        }
        newIdx++;
      }
      return next;
    });
  };

  const handleClose = () => {
    if (step === 4) {
      localStorage.removeItem(STORAGE_KEY);
    }
    onClose();
  };

  // Feature 7: Toggle row details on mobile
  const toggleRowExpand = (idx) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // C1: Compute available categories based on selected typ for rule form
  const ruleCategories = Object.keys(kategorie?.[ruleForm.typ] || {});
  const ruleSubcategories = kategorie?.[ruleForm.typ]?.[ruleForm.kategoria] || [];

  // Count unmapped transactions
  const unmappedCount = transactions.filter(
    tx => tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane'
  ).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100 z-10 shrink-0">
          <h2 className="text-xl font-bold">Import z CSV</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 font-bold text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto flex-1">
          {/* D3: Inline error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2 font-bold">&#10005;</button>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center">
                <p className="text-gray-700 mb-4">Przeciągnij plik CSV lub kliknij aby wybrać</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block mx-auto"
                />
              </div>
              <p className="text-sm text-gray-600">
                Obsługiwane formaty: CSV z nagłówkami kolumn, CSV bez nagłówków, zestawienia PKO BP
              </p>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Mapowanie kolumn</h3>
              {detectedFormat === 'pko_bp' && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                  Wykryto format <strong>PKO BP</strong> &mdash; kolumny zostały automatycznie zmapowane, a opisy transakcji wyodrębnione z danych bankowych.
                </div>
              )}
              <p className="text-gray-600">Wskaż które kolumny zawierają jakie dane</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data operacji <span className="text-red-500">*</span></label>
                  <select
                    value={columnMapping.data || ''}
                    onChange={(e) => handleMappingChange('data', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kwota / Obciążenia <span className="text-red-500">*</span></label>
                  <select
                    value={columnMapping.kwota || ''}
                    onChange={(e) => handleMappingChange('kwota', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Uznania (wpływy)
                    <span className="text-gray-400 font-normal ml-1">- dla iPKO</span>
                  </label>
                  <select
                    value={columnMapping.uznania || ''}
                    onChange={(e) => handleMappingChange('uznania', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Brak (jedna kolumna kwoty)</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opis/Notatka</label>
                  <select
                    value={columnMapping.opis || ''}
                    onChange={(e) => handleMappingChange('opis', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Wybierz kolumnę</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* A: Selector osoby */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Osoba <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedOsoba}
                  onChange={(e) => setSelectedOsoba(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Wybierz osobę --</option>
                  {osoby.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Podgląd danych */}
              {csvData && csvData.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 border-b border-gray-200">
                    Podgląd danych ({csvData.length} wierszy) &mdash; pierwsze 3:
                  </div>
                  <div className="overflow-auto max-h-[160px]">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {headers.map(h => (
                            <th key={h} className="px-2 py-1 text-left whitespace-nowrap font-medium text-gray-700 border-b border-gray-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            {headers.map(h => (
                              <td key={h} className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate text-gray-600">{row[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3 space-y-1">
                <p className="text-sm text-indigo-800">
                  Format daty: YYYY-MM-DD. Kwota ujemna = wydatek, dodatnia = przychód
                </p>
                <p className="text-xs text-indigo-600">
                  iPKO: Zmapuj &quot;Obciążenia&quot; jako Kwota i &quot;Uznania&quot; jako Uznania. Opis zmapuj na kolumnę &quot;Opis&quot; lub &quot;Odbiorca/Zleceniodawca&quot;.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(1); setDetectedFormat(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Wstecz
                </button>
                <button
                  onClick={prepareTransactions}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Dalej
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-lg">
                  Podgląd importu ({transactions.length} transakcji)
                </h3>
                <div className="flex items-center gap-3">
                  {lastSaved && (
                    <span className="text-xs text-gray-400">
                      Auto-zapis: {lastSaved.toLocaleTimeString('pl-PL')}
                    </span>
                  )}
                  {/* Feature 7: Toggle details column */}
                  <button
                    onClick={() => setShowDetailsColumn(!showDetailsColumn)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      showDetailsColumn
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {showDetailsColumn ? 'Ukryj szczegóły' : 'Pokaż szczegóły'}
                  </button>
                </div>
              </div>

              {/* Rule notification */}
              {ruleNotification && (
                <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center justify-between animate-[slideIn_0.3s_ease-out]">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-bold text-lg">&#10003;</span>
                    <div className="text-sm text-green-800">
                      <span className="font-medium">Reguła dodana!</span>{' '}
                      {ruleNotification.matchCount > 0 ? (
                        <>Automatycznie przypisano <strong>{ruleNotification.matchCount}</strong> transakcji
                          do kategorii <strong>{ruleNotification.kategoria}</strong>
                          {ruleNotification.podkategoria && <> &gt; <strong>{ruleNotification.podkategoria}</strong></>}
                        </>
                      ) : (
                        <>Brak pasujących nieprzypisanych transakcji</>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setRuleNotification(null)}
                    className="text-green-600 hover:text-green-800 ml-2"
                  >
                    &#10005;
                  </button>
                </div>
              )}

              {/* Table wrapper with its own scroll context so thead sticks within it */}
              <div className="overflow-auto border border-gray-200 rounded-lg max-h-[40vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-[1]">
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Data</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">Kwota</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Opis</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Kategoria</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Podkategoria</th>
                      {showDetailsColumn && (
                        <th className="px-3 py-2 text-left whitespace-nowrap hidden md:table-cell">Informacje dodatkowe</th>
                      )}
                      <th className="px-3 py-2 text-center whitespace-nowrap">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`border-t hover:bg-gray-50 ${
                          tx.kategoria === 'Inne' && tx.podkategoria === 'Nieprzewidziane'
                            ? 'bg-yellow-50/50'
                            : ''
                        }`}>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={tx.data}
                              onChange={(e) => handleEditTransaction(idx, 'data', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full min-w-[130px]"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={tx.kwota}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const normalized = raw.replace(',', '.');
                                if (normalized === '' || normalized === '-' || /^-?\d*\.?\d*$/.test(normalized)) {
                                  handleEditTransaction(idx, 'kwota', normalized);
                                }
                              }}
                              onBlur={(e) => {
                                const val = parseKwota(e.target.value);
                                handleEditTransaction(idx, 'kwota', val);
                              }}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full text-right min-w-[90px]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={tx.opis}
                              onChange={(e) => handleEditTransaction(idx, 'opis', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full text-sm min-w-[120px]"
                            />
                          </td>
                          {/* C1: Select kategorii zależy od tx.typ */}
                          <td className="px-3 py-2">
                            <select
                              value={tx.kategoria}
                              onChange={(e) => handleEditTransaction(idx, 'kategoria', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full text-sm min-w-[110px]"
                            >
                              {Object.keys(kategorie?.[tx.typ] || {}).map(k => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={tx.podkategoria}
                              onChange={(e) => handleEditTransaction(idx, 'podkategoria', e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 w-full text-sm min-w-[120px]"
                            >
                              {(kategorie?.[tx.typ]?.[tx.kategoria] || []).map(pk => (
                                <option key={pk} value={pk}>{pk}</option>
                              ))}
                            </select>
                          </td>
                          {/* Feature 7: Details column - visible on desktop, using txMeta */}
                          {showDetailsColumn && (
                            <td className="px-3 py-2 hidden md:table-cell">
                              <div className="text-xs text-gray-500 space-y-0.5 max-w-[200px]">
                                {txMeta[idx]?._originalOpis && txMeta[idx]._originalOpis !== tx.opis && (
                                  <div><span className="font-medium text-gray-600">Oryginał:</span> {txMeta[idx]._originalOpis}</div>
                                )}
                                {txMeta[idx]?._csvRaw && Object.entries(txMeta[idx]._csvRaw).map(([key, value]) => (
                                  value ? (
                                    <div key={key} className="truncate">
                                      <span className="font-medium text-gray-600">{key}:</span> {value}
                                    </div>
                                  ) : null
                                ))}
                                {(!txMeta[idx]?._csvRaw || Object.keys(txMeta[idx]._csvRaw).length === 0) && !txMeta[idx]?._originalOpis && (
                                  <div className="text-gray-400 italic">Brak dodatkowych danych</div>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {/* Feature 7: Mobile expand button */}
                              {showDetailsColumn && (
                                <button
                                  onClick={() => toggleRowExpand(idx)}
                                  className="md:hidden text-indigo-500 hover:text-indigo-700 text-sm px-1"
                                  title="Szczegóły"
                                >
                                  {expandedRows.has(idx) ? '\u25B2' : '\u25BC'}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteTransaction(idx)}
                                className="text-red-600 hover:text-red-800 font-bold"
                              >
                                &#10005;
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Feature 7: Expandable details row for mobile, using txMeta */}
                        {showDetailsColumn && expandedRows.has(idx) && (
                          <tr className="md:hidden border-t bg-gray-50">
                            <td colSpan={7} className="px-4 py-2">
                              <div className="text-xs text-gray-500 space-y-1">
                                <div className="font-medium text-gray-700 mb-1">Informacje dodatkowe:</div>
                                {txMeta[idx]?._originalOpis && txMeta[idx]._originalOpis !== tx.opis && (
                                  <div><span className="font-medium text-gray-600">Oryginalny opis:</span> {txMeta[idx]._originalOpis}</div>
                                )}
                                <div><span className="font-medium text-gray-600">Data:</span> {tx.data}</div>
                                <div><span className="font-medium text-gray-600">Typ:</span> {tx.typ}</div>
                                {txMeta[idx]?._csvRaw && Object.entries(txMeta[idx]._csvRaw).map(([key, value]) => (
                                  value ? (
                                    <div key={key}>
                                      <span className="font-medium text-gray-600">{key}:</span> {value}
                                    </div>
                                  ) : null
                                ))}
                                {(!txMeta[idx]?._csvRaw || Object.keys(txMeta[idx]._csvRaw).length === 0) && (
                                  <div className="text-gray-400 italic">Brak dodatkowych pól z CSV</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Feature 6: Recognition rules panel - always visible at bottom of step 3 */}
              <div className="border rounded-lg bg-indigo-50 border-indigo-200">
                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-700 font-medium text-sm">
                      Reguły rozpoznawania
                    </span>
                    {recognitionRules.length > 0 && (
                      <span className="text-xs bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">
                        {recognitionRules.length}
                      </span>
                    )}
                    {unmappedCount > 0 && (
                      <span className="text-xs text-amber-600">
                        ({unmappedCount} nieprzypisanych)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {recognitionRules.length > 0 && (
                      <button
                        onClick={() => { setShowRulesList(!showRulesList); setShowRuleForm(false); }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        {showRulesList ? 'Ukryj listę' : 'Lista reguł'}
                      </button>
                    )}
                    <button
                      onClick={() => { setShowRuleForm(!showRuleForm); setShowRulesList(false); }}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        showRuleForm
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {showRuleForm ? 'Anuluj' : '+ Dodaj regułę'}
                    </button>
                  </div>
                </div>

                {/* Rules list */}
                {showRulesList && recognitionRules.length > 0 && (
                  <div className="px-4 pb-3 border-t border-indigo-200 pt-3">
                    <div className="space-y-1.5 max-h-[120px] overflow-auto">
                      {recognitionRules.map((rule, i) => (
                        <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 text-xs">
                          <span>
                            Jeśli opis zawiera &quot;<strong>{rule.keyword}</strong>&quot; &rarr;{' '}
                            <span className="text-indigo-600 font-medium">{rule.kategoria}</span>
                            {rule.podkategoria && (
                              <> &gt; <span className="text-indigo-500">{rule.podkategoria}</span></>
                            )}
                          </span>
                          <button
                            onClick={() => handleDeleteRule(i)}
                            className="text-red-400 hover:text-red-600 ml-2 font-bold"
                          >
                            &#10005;
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
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Warunek (tekst w opisie)
                        </label>
                        <input
                          type="text"
                          value={ruleForm.keyword}
                          onChange={(e) => setRuleForm(prev => ({ ...prev, keyword: e.target.value }))}
                          placeholder="np. Biedronka, Allegro..."
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
                        />
                      </div>
                      {/* C1: Typ selector for rule form */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Typ
                        </label>
                        <select
                          value={ruleForm.typ}
                          onChange={(e) => setRuleForm(prev => ({
                            ...prev,
                            typ: e.target.value,
                            kategoria: '',
                            podkategoria: '',
                          }))}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
                        >
                          <option value="Wydatek">Wydatek</option>
                          <option value="Przychód">Przychód</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Kategoria
                        </label>
                        <select
                          value={ruleForm.kategoria}
                          onChange={(e) => setRuleForm(prev => ({
                            ...prev,
                            kategoria: e.target.value,
                            podkategoria: '',
                          }))}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
                        >
                          <option value="">Wybierz...</option>
                          {ruleCategories.map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Podkategoria (opcjonalnie)
                        </label>
                        <select
                          value={ruleForm.podkategoria}
                          onChange={(e) => setRuleForm(prev => ({ ...prev, podkategoria: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
                          disabled={!ruleForm.kategoria}
                        >
                          <option value="">Wybierz...</option>
                          {ruleSubcategories.map(pk => (
                            <option key={pk} value={pk}>{pk}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={handleAddRule}
                          className="w-full px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                          Dodaj i zastosuj
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Reguła zostanie zastosowana do nieprzypisanych transakcji i zapisana do przyszłych importów.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Wstecz
                </button>
                <button
                  onClick={handleImport}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? 'Importuję...' : 'Importuj transakcje'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center space-y-4">
              <div className="text-5xl">&#10003;</div>
              <h3 className="font-semibold text-lg text-green-600">
                Import zakończony pomyślnie!
              </h3>
              <p className="text-gray-600">
                Zaimportowano {transactions.length} transakcji
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
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
