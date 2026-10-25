import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../services/api';
import * as categoryAI from '../../services/categoryAI';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';
import { zastosujRegule } from '../../lib/csvImport/kategoryzacja';
import { bezKategorii, edytujPole, liczStatusy, przesunDate } from '../../lib/csvImport/przygotowanie';
import {
  wierszeZKolejki,
  zastosujPropozycje,
  ustawUdzial,
  pasujeDoFiltrow,
  pozycjeZatwierdzenia,
  miesiaceKolejki,
  zrodlaKolejki,
} from '../../lib/csvImport/rozliczenie';
import { useRecognitionRules, MIN_KEYWORD } from './useRecognitionRules';
import { useAiCategorization } from './useAiCategorization';
import LocalRulesMigrationDialog from './LocalRulesMigrationDialog';
import KolejkaLista from './KolejkaLista';

const formatZl = (n) =>
  `${Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

const FILTRY_POCZATKOWE = { status: 'wszystkie', miesiac: '', zrodlo: '' };

/**
 * Widok „Do rozliczenia" (#132): operacje z kolejki importu kategoryzowane
 * ręcznie, partiami, z dowolnego urządzenia. Propozycje (reguły, słownik,
 * AI, parowanie z zobowiązaniami) liczone są w przeglądarce przy otwarciu
 * i żyją tylko w pamięci — do bazy trafia dopiero zatwierdzenie
 * (kolejka_zatwierdz) albo wykluczenie (UPDATE status przez RLS).
 */
export default function Kolejka({ kategorie = {}, osoby = [], onZmiana, onDirtyChange }) {
  const { addToast } = useToast();
  const aiEnabled = categoryAI.isAIEnabled();
  const {
    rules, zaladowane: regulyGotowe, addRule, deleteRule,
    lokalne, przeniesLokalne, odrzucLokalne, pozniejLokalne,
  } = useRecognitionRules();

  const [zakladka, setZakladka] = useState('nowy');
  const [lista, setLista] = useState([]);
  const [wykluczone, setWykluczone] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [filtry, setFiltry] = useState(FILTRY_POCZATKOWE);
  const [zmienione, setZmienione] = useState(false);
  const [ladowania, setLadowania] = useState(0);
  const [ruleNotification, setRuleNotification] = useState(null);
  // Kontekst parowania z ostatniego załadowania — dla przywróconych wierszy.
  const kontekstRef = useRef(null);

  const { aiLoading, aiMatchCount } = useAiCategorization({
    uruchom: ladowania, aiEnabled, transactions: lista, setTransactions: setLista, kategorie,
  });

  // ── Ładowanie ────────────────────────────────────────────────────────────────

  const zPropozycjami = useCallback((dowody) => {
    const wiersze = wierszeZKolejki(dowody, { rules, kategorie });
    return zastosujPropozycje(wiersze, kontekstRef.current, kategorie);
  }, [rules, kategorie]);

  const zaladuj = useCallback(async () => {
    try {
      const dowody = await api.getKolejka();
      kontekstRef.current = null;
      if (dowody.length > 0) {
        const daty = dowody.map(d => d.data).sort();
        kontekstRef.current = await api.getKontekstParowania(
          przesunDate(daty[0], -2), przesunDate(daty[daty.length - 1], 2), { hmacAliasow: true }
        );
      }
      setLista(zPropozycjami(dowody));
      setZmienione(false);
      setError(null);
      setLadowania(n => n + 1);
    } catch (err) {
      logger.error('Kolejka', 'ładowanie kolejki nie powiodło się:', err);
      setError(err.brakMigracji
        ? 'Baza nie ma migracji kolejki importu.'
        : 'Nie udało się wczytać kolejki. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  }, [zPropozycjami]);

  // Propozycje liczymy raz, po wczytaniu reguł — późniejsza zmiana reguł
  // nie przelicza listy (nadpisałaby ręczne edycje).
  const pierwszeLadowanie = useRef(false);
  useEffect(() => {
    if (!regulyGotowe || pierwszeLadowanie.current) return;
    pierwszeLadowanie.current = true;
    zaladuj();
  }, [regulyGotowe, zaladuj]);

  useEffect(() => {
    if (zakladka !== 'wykluczony') return;
    let anulowane = false;
    api.getKolejka({ status: 'wykluczony' }).then(
      d => { if (!anulowane) setWykluczone(d); },
      err => {
        logger.error('Kolejka', 'ładowanie wykluczonych nie powiodło się:', err);
        if (!anulowane) setError('Nie udało się wczytać wykluczonych operacji.');
      }
    );
    return () => { anulowane = true; };
  }, [zakladka]);

  // ── Niezapisane edycje ──────────────────────────────────────────────────────

  useEffect(() => { onDirtyChange?.(zmienione); }, [zmienione, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!zmienione) return;
    const ostrzez = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', ostrzez);
    return () => window.removeEventListener('beforeunload', ostrzez);
  }, [zmienione]);

  useEffect(() => {
    if (!ruleNotification) return;
    const t = setTimeout(() => setRuleNotification(null), 4000);
    return () => clearTimeout(t);
  }, [ruleNotification]);

  // ── Edycja (tylko w pamięci) ─────────────────────────────────────────────────

  const zmien = (id, fn) => {
    setLista(prev => prev.map(tx => (tx.dowodId === id ? fn(tx) : tx)));
    setZmienione(true);
  };

  const handleEdit = (id, field, value) => zmien(id, tx => {
    let next = edytujPole(tx, field, value);
    if (field === 'kategoria') {
      const podkategorie = kategorie?.[tx.typ]?.[value] || [];
      next = { ...next, podkategoria: podkategorie.includes(tx.podkategoria) ? tx.podkategoria : (podkategorie[0] ?? '') };
    }
    if (field === 'kategoria' || field === 'podkategoria') {
      next = { ...next, _dedup: { ...next._dedup, wybrana: !bezKategorii(next) } };
    }
    return next;
  });

  const handleUdzial = (id, udzial) => zmien(id, tx => ustawUdzial(tx, udzial));

  const handleDedupChange = (id, zmiany) => zmien(id, tx => ({ ...tx, _dedup: { ...tx._dedup, ...zmiany } }));

  // ── Reguły ───────────────────────────────────────────────────────────────────

  const handleAddRule = async ({ keyword, kategoria, podkategoria, typ }) => {
    if (keyword.trim().length < MIN_KEYWORD) { setError(`Warunek musi mieć co najmniej ${MIN_KEYWORD} znaki`); return false; }
    if (!kategoria) { setError('Wybierz kategorię'); return false; }
    const regula = { keyword: keyword.trim(), kategoria, podkategoria: podkategoria || '', typ };
    try {
      const wynik = await addRule(regula);
      if (wynik.duplikat) { setError(`Reguła „${regula.keyword}” już istnieje`); return false; }
    } catch (err) {
      logger.error('Kolejka', 'addRule failed:', err);
      setError('Nie udało się zapisać reguły');
      return false;
    }
    if (aiEnabled) {
      categoryAI.saveCategoryRule(regula.keyword, kategoria, podkategoria, 'manual')
        .catch(err => logger.error('Kolejka', 'saveCategoryRule failed:', err));
    }
    const { updated, matchCount } = zastosujRegule(regula, lista);
    setLista(updated.map((tx, i) => (tx === lista[i] ? tx : { ...tx, _dedup: { ...tx._dedup, wybrana: true } })));
    if (matchCount > 0) setZmienione(true);
    setRuleNotification({ keyword: regula.keyword, kategoria, podkategoria, matchCount });
    return true;
  };

  const handleDeleteRule = (id) => deleteRule(id).catch(err => {
    logger.error('Kolejka', 'deleteRule failed:', err);
    setError('Nie udało się usunąć reguły');
  });

  // ── Zatwierdzanie i wykluczanie ─────────────────────────────────────────────

  const widoczne = useMemo(() => lista.filter(tx => pasujeDoFiltrow(tx, filtry)), [lista, filtry]);
  const doZatwierdzenia = widoczne.filter(tx => tx._dedup?.wybrana !== false);

  // Usuwa z listy rozliczone wiersze i te, których nie ma już w kolejce
  // (zatwierdzone/wykluczone na innym urządzeniu) — bez gubienia edycji reszty.
  const odswiezPo = async (usunieteIds) => {
    const usuniete = new Set(usunieteIds);
    let wBazie = null;
    try {
      wBazie = new Set((await api.getKolejka()).map(d => d.id));
    } catch (err) {
      logger.error('Kolejka', 'odświeżenie kolejki nie powiodło się:', err);
    }
    setLista(prev => prev.filter(tx => !usuniete.has(tx.dowodId) && (!wBazie || wBazie.has(tx.dowodId))));
  };

  const handleZatwierdz = async () => {
    if (doZatwierdzenia.length === 0) return;
    if (doZatwierdzenia.some(tx => !tx.osoba)) { setError('Każda zatwierdzana operacja musi mieć osobę'); return; }
    if (doZatwierdzenia.some(tx => !tx.kategoria)) { setError('Każda zatwierdzana operacja musi mieć kategorię'); return; }

    setIsSaving(true);
    try {
      const wynik = await api.zatwierdzKolejke(pozycjeZatwierdzenia(doZatwierdzenia));
      const zapisane = wynik.zatwierdzone + wynik.dolaczone;
      if (zapisane > 0) addToast(`Zatwierdzono ${zapisane} ${zapisane === 1 ? 'operację' : 'operacji'}`);
      if (wynik.pominiete > 0) {
        addToast(`${wynik.pominiete} ${wynik.pominiete === 1 ? 'operacja była' : 'operacji było'} już rozliczonych na innym urządzeniu — lista odświeżona`, 'info');
      }
      await odswiezPo(wynik.wyniki.map(w => w.dowod_id));
      if (aiEnabled) {
        categoryAI.saveCategoryRulesBatch(doZatwierdzenia.filter(tx => tx._dedup?.akcja !== 'dolacz'))
          .catch(err => logger.error('Kolejka', 'saveCategoryRulesBatch failed:', err));
      }
      onZmiana?.();
    } catch (err) {
      logger.error('Kolejka', 'zatwierdzanie nie powiodło się:', err);
      setError(err.message || 'Nie udało się zatwierdzić operacji');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWyklucz = async (id) => {
    try {
      const n = await api.ustawStatusKolejki([id], 'wykluczony');
      if (n === 0) addToast('Operacja była już rozliczona na innym urządzeniu — lista odświeżona', 'info');
      await odswiezPo([id]);
      setWykluczone(null);
      onZmiana?.();
    } catch (err) {
      logger.error('Kolejka', 'wykluczenie nie powiodło się:', err);
      setError('Nie udało się wykluczyć operacji');
    }
  };

  const handlePrzywroc = async (dowod) => {
    try {
      const n = await api.ustawStatusKolejki([dowod.id], 'nowy');
      setWykluczone(prev => (prev ?? []).filter(d => d.id !== dowod.id));
      if (n > 0) setLista(prev => [...prev, ...zPropozycjami([{ ...dowod, status: 'nowy' }])]
        .sort((a, b) => a.data.localeCompare(b.data)));
      onZmiana?.();
    } catch (err) {
      logger.error('Kolejka', 'przywrócenie nie powiodło się:', err);
      setError('Nie udało się przywrócić operacji');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4 min-w-0" aria-labelledby="kolejka-title">
      <div className="rounded-3xl bg-white/80 border border-gray-100 shadow-sm p-4 sm:p-6 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="kolejka-title" className="text-lg font-semibold text-gray-800">
            Do rozliczenia
            <span className="ml-2 text-sm font-normal text-gray-400">({lista.length})</span>
          </h2>
          <div className="flex gap-1 bg-gray-50 rounded-2xl border border-gray-100 p-1" role="tablist" aria-label="Kolejka">
            {[['nowy', 'Do rozliczenia'], ['wykluczony', 'Wykluczone']].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={zakladka === id}
                onClick={() => setZakladka(id)}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-all ${
                  zakladka === id ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Zamknij komunikat błędu" className="text-rose-400 hover:text-rose-600 ml-2 font-bold">&#10005;</button>
          </div>
        )}

        {zakladka === 'nowy' && (isLoading ? (
          <p className="text-sm text-gray-500 text-center py-10">Ładowanie kolejki…</p>
        ) : (
          <KolejkaLista
            widoczne={widoczne}
            liczbaWszystkich={lista.length}
            kategorie={kategorie}
            osoby={osoby}
            filtry={filtry}
            setFiltry={setFiltry}
            liczbyStatusow={liczStatusy(lista)}
            miesiace={miesiaceKolejki(lista)}
            zrodla={zrodlaKolejki(lista)}
            aiEnabled={aiEnabled}
            aiLoading={aiLoading}
            aiMatchCount={aiMatchCount}
            unmappedCount={lista.filter(bezKategorii).length}
            ruleNotification={ruleNotification}
            onDismissRuleNotification={() => setRuleNotification(null)}
            rules={rules}
            onAddRule={handleAddRule}
            onDeleteRule={handleDeleteRule}
            liczbaDoZatwierdzenia={doZatwierdzenia.length}
            isSaving={isSaving}
            onEdit={handleEdit}
            onUdzial={handleUdzial}
            onDedupChange={handleDedupChange}
            onWyklucz={handleWyklucz}
            onZatwierdz={handleZatwierdz}
          />
        ))}

        {zakladka === 'wykluczony' && (wykluczone === null ? (
          <p className="text-sm text-gray-500 text-center py-10">Ładowanie…</p>
        ) : wykluczone.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">Brak wykluczonych operacji.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
            {wykluczone.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm min-w-0">
                <div className="min-w-0">
                  <div className="text-gray-800 truncate">{d.opis || '—'}</div>
                  <div className="text-xs text-gray-400">{d.data} · {d.zrodlo} · {formatZl(d.kwota_pelna)}</div>
                </div>
                <button
                  onClick={() => handlePrzywroc(d)}
                  aria-label={`Przywróć operację z ${d.data}`}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  Przywróć
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>

      <LocalRulesMigrationDialog
        lokalne={lokalne}
        onPrzenies={() => przeniesLokalne().catch(err => {
          logger.error('Kolejka', 'przeniesLokalne failed:', err);
          setError('Nie udało się przenieść reguł — spróbuj ponownie');
        })}
        onOdrzuc={odrzucLokalne}
        onPozniej={pozniejLokalne}
      />
    </section>
  );
}
