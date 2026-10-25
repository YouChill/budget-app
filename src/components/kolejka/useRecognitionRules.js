import { useCallback, useEffect, useState } from 'react';
import * as api from '../../services/api';
import { logger } from '../../utils/logger';

// Klucz, pod którym reguły leżały w localStorage przed #133 — dziś tylko
// do jednorazowego przeniesienia do bazy.
export const RULES_STORAGE_KEY = 'csv_recognition_rules';
export const MIN_KEYWORD = 3;

/** Reguły z localStorage tego urządzenia: { doPrzeniesienia, krotkie } albo null. */
export function czytajLokalneReguly() {
  try {
    const lista = JSON.parse(localStorage.getItem(RULES_STORAGE_KEY) || 'null');
    if (!Array.isArray(lista) || lista.length === 0) return null;
    const poprawne = lista.filter(r => typeof r?.keyword === 'string' && r.kategoria);
    return {
      doPrzeniesienia: poprawne.filter(r => r.keyword.trim().length >= MIN_KEYWORD),
      krotkie: poprawne.filter(r => r.keyword.trim().length < MIN_KEYWORD),
    };
  } catch {
    return null;
  }
}

const usunLokalne = () => {
  try { localStorage.removeItem(RULES_STORAGE_KEY); } catch { /* ignore */ }
};

// Reguły rozpoznawania gospodarstwa („opis zawiera X → kategoria") z bazy —
// wspólne dla domowników i urządzeń. Kształt { id, keyword, kategoria,
// podkategoria, typ } jak dawniej, więc categorizeDescription i zastosujRegule
// działają bez zmian.
export function useRecognitionRules() {
  const [rules, setRules] = useState([]);
  // false = baza bez migracji reguł (dodawanie wyłączone)
  const [dostepne, setDostepne] = useState(true);
  const [lokalne, setLokalne] = useState(null);
  // true po pierwszej próbie pobrania (także nieudanej) — widok kolejki
  // liczy propozycje dopiero wtedy, żeby reguły nie przyszły po fakcie.
  const [zaladowane, setZaladowane] = useState(false);

  const zastosuj = useCallback((lista) => {
    setDostepne(lista !== null);
    setRules(lista ?? []);
  }, []);

  const odswiez = useCallback(
    () => api.getReguly().then(zastosuj, err => logger.error('useRecognitionRules', 'getReguly failed:', err)),
    [zastosuj]
  );

  useEffect(() => {
    let anulowane = false;
    api.getReguly().then(
      lista => {
        if (anulowane) return;
        zastosuj(lista);
        // Propozycja przeniesienia dopiero, gdy baza ma tabelę reguł.
        if (lista !== null) setLokalne(czytajLokalneReguly());
        setZaladowane(true);
      },
      err => {
        logger.error('useRecognitionRules', 'getReguly failed:', err);
        if (!anulowane) setZaladowane(true);
      }
    );
    return () => { anulowane = true; };
  }, [zastosuj]);

  // Zwraca { regula } | { duplikat: true }; błąd sieci/bazy rzuca dalej.
  const addRule = async (rule) => {
    const wynik = await api.addRegula(rule);
    if (wynik.regula) setRules(prev => [...prev, wynik.regula]);
    return wynik;
  };

  const deleteRule = async (id) => {
    await api.deleteRegula(id);
    setRules(prev => prev.filter(r => r.id !== id));
  };

  // Przeniesienie reguł z localStorage: duplikaty ignorowane, klucz usuwany
  // dopiero po zapisie wszystkich (błąd w połowie → propozycja wraca).
  const przeniesLokalne = async () => {
    const { doPrzeniesienia = [] } = lokalne ?? {};
    let przeniesione = 0;
    for (const r of doPrzeniesienia) {
      const wynik = await api.addRegula({ ...r, keyword: r.keyword.trim() });
      if (wynik.regula) przeniesione++;
    }
    usunLokalne();
    setLokalne(null);
    await odswiez();
    return przeniesione;
  };

  const odrzucLokalne = () => {
    usunLokalne();
    setLokalne(null);
  };

  // Bez decyzji — propozycja wróci przy następnym otwarciu.
  const pozniejLokalne = () => setLokalne(null);

  return { rules, dostepne, zaladowane, addRule, deleteRule, lokalne, przeniesLokalne, odrzucLokalne, pozniejLokalne };
}
