// Kategoryzacja opisów z wyciągu: słowa kluczowe, reguły użytkownika
// i dopasowanie do słownika kategorii gospodarstwa.

// ─── Keyword → category mapping ──────────────────────────────────────────────
export const categoryMapping = {
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

export const categorizeDescription = (description, userRules = [], typ = 'Wydatek') => {
  if (!description) return null;
  const lowerDesc = description.toLowerCase();
  for (const rule of userRules) {
    // Reguły sprzed wprowadzenia pola typ (bez rule.typ) stosujemy do obu typów.
    if (rule.typ && rule.typ !== typ) continue;
    if (lowerDesc.includes(rule.keyword.toLowerCase())) {
      return { kategoria: rule.kategoria, podkategoria: rule.podkategoria };
    }
  }
  // Wbudowany słownik zawiera wyłącznie kategorie wydatkowe — nie stosujemy go
  // do przychodów (np. zwrot „ZWROT ZAKUP BIEDRONKA" to nie wydatek Jedzenie).
  if (typ !== 'Wydatek') return null;
  for (const [keyword, category] of Object.entries(categoryMapping)) {
    if (lowerDesc.includes(keyword)) return category;
  }
  return null;
};

// Tytuł przelewu wskazujący rodzinę — zwrot od rodziców to rozliczenie, nie zwrot zakupu.
const RODZINA_RE = /\b(mama|mamy|mamo|tata|taty|tato|rodzice|rodzic[oó]w)\b/i;

/**
 * Strażnik znaku (skill rozliczenia-budzetu): reguły tekstowe nie patrzą na
 * znak kwoty, więc przychód potrafi dostać kategorię wydatkową („jajka" →
 * Jedzenie). Para spoza słownika TEGO typu jest przekierowywana — dla
 * przychodu do „Inne przychody", bo „Inne / Nieprzewidziane" istnieje tylko
 * po stronie wydatków.
 */
const fallbackKategorii = (kategorieProp, typ, opis) => {
  const inne = kategorieProp?.[typ]?.['Inne przychody'];
  if (typ === 'Przychód' && inne) {
    if (RODZINA_RE.test(opis || '') && inne.includes('Rozliczenia rodzinne')) {
      return { kategoria: 'Inne przychody', podkategoria: 'Rozliczenia rodzinne' };
    }
    return { kategoria: 'Inne przychody', podkategoria: inne.includes('Zwroty') ? 'Zwroty' : '' };
  }
  return { kategoria: 'Inne', podkategoria: 'Nieprzewidziane' };
};

export const validateCategoryExists = (kategoria, podkategoria, kategorieProp, typ, opis = '') => {
  const catExists = kategorieProp?.[typ]?.[kategoria];
  if (!catExists) return fallbackKategorii(kategorieProp, typ, opis);
  const subExists = catExists.includes(podkategoria);
  return { kategoria, podkategoria: subExists ? podkategoria : '' };
};

/**
 * Stosuje regułę rozpoznawania do wierszy jeszcze bez kategorii
 * (Inne/Nieprzewidziane) i zgodnych typem. Zwraca nową listę i liczbę trafień.
 */
export const zastosujRegule = (rule, transakcje) => {
  const keyword = rule.keyword.toLowerCase();
  let matchCount = 0;
  const updated = transakcje.map(tx => {
    if (tx.kategoria !== 'Inne' || tx.podkategoria !== 'Nieprzewidziane') return tx;
    if (rule.typ && tx.typ !== rule.typ) return tx;
    if ((tx.opis || '').toLowerCase().includes(keyword)) {
      matchCount++;
      return { ...tx, kategoria: rule.kategoria, podkategoria: rule.podkategoria || '' };
    }
    return tx;
  });
  return { updated, matchCount };
};
