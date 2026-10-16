// Liczba transakcji przypisanych do kategorii/podkategorii lub osoby —
// panel ustawień ostrzega przed usunięciem pozycji, która jest w użyciu.

export function countTransactionsForCategory(transakcje, typ, kategoria, podkategoria = null) {
  return transakcje.filter(t => {
    if (t.typ !== typ || t.kategoria !== kategoria) return false;
    if (podkategoria) return t.podkategoria === podkategoria;
    return true;
  }).length;
}

export function countTransactionsForOsoba(transakcje, osoba) {
  return transakcje.filter(t => t.osoba === osoba).length;
}
