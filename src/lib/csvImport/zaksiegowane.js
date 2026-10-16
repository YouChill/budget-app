import * as api from '../../services/api';
import { logger } from '../../utils/logger';
import { naGrosze, rozroznijPowtorzenia, sha256Hex } from '../odciski';
import { parujPartie } from '../parowanie';
import { przesunDate, zastosujParowanie } from './przygotowanie';

// ── Rozpoznawanie już zaksięgowanych (krok 2 → 3) ─────────────────────────────
// Odciski → zapytanie o istniejące → parowanie z zobowiązaniami i wpisami
// bez dowodu. Błąd sieci lub brak migracji 014 nie blokuje importu —
// podgląd pokazuje wtedy ostrzeżenie, a zapis idzie starą ścieżką.
//
// Zwraca { lista, dedupInfo }: dedupInfo = { dostepny: bool, powod?: 'migracja' | 'blad' }.
export const oznaczZaksiegowane = async (lista, kategorie) => {
  const bezKlucza = (tx) => {
    const { _zrodlo, ...reszta } = tx;
    return reszta;
  };
  try {
    const klucze = rozroznijPowtorzenia(lista.map(tx => tx._zrodlo.klucz));
    const odciski = await Promise.all(klucze.map(k => sha256Hex(k)));
    const zrodlo = lista[0]._zrodlo.zrodlo;

    const istniejace = await api.sprawdzOdciski(zrodlo, odciski);
    if (istniejace === null) {
      return { lista: lista.map(bezKlucza), dedupInfo: { dostepny: false, powod: 'migracja' } };
    }

    const daty = lista.map(tx => tx.data).sort();
    const kontekst = await api.getKontekstParowania(przesunDate(daty[0], -2), przesunDate(daty[daty.length - 1], 2));
    if (kontekst === null) {
      return { lista: lista.map(bezKlucza), dedupInfo: { dostepny: false, powod: 'migracja' } };
    }

    const wiersze = lista.map((tx, i) => ({
      zrodloId: odciski[i],
      data: tx.data,
      typ: tx.typ,
      kwotaGr: Math.abs(naGrosze(tx.kwota)),
      opis: tx.opis,
      tytul: tx._zrodlo.tytul,
      rachunek: tx._zrodlo.rachunek,
    }));
    const wyniki = parujPartie(wiersze, {
      istniejace: new Set(istniejace.keys()),
      zobowiazania: kontekst.zobowiazania,
      aliasy: kontekst.aliasy,
      bezDowodu: kontekst.bezDowodu,
    });

    return {
      dedupInfo: { dostepny: true },
      lista: zastosujParowanie(
        lista.map((tx, i) => ({
          ...bezKlucza(tx),
          _dedup: {
            zrodlo,
            zrodlo_id: odciski[i],
            surowe: tx._zrodlo.surowe,
            // null = dowód jest, ale jego transakcję usunięto
            istniejacaTransakcja: istniejace.get(odciski[i]) ?? null,
          },
        })),
        wyniki,
        kategorie
      ),
    };
  } catch (err) {
    logger.error('CSVImport', 'rozpoznawanie zaksięgowanych nie powiodło się:', err);
    return { lista: lista.map(bezKlucza), dedupInfo: { dostepny: false, powod: 'blad' } };
  }
};
