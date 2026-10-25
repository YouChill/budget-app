# Import transakcji z CSV

Funkcja umożliwia masowy import transakcji z pliku CSV — eliminuje konieczność ręcznego wpisywania operacji z wyciągu bankowego. Obsługuje automatyczną kategoryzację opartą na słowach kluczowych oraz opcjonalnie na AI (pgvector + OpenAI).

## Jak używać

### 1. Otwórz okno importu

Kliknij ikonę importu w nagłówku aplikacji.

### 2. Prześlij plik (Krok 1)

- **Przeciągnij plik CSV** na strefę drop
- lub kliknij **„Wybierz plik z dysku"**

Obsługiwane formaty są wykrywane automatycznie:

| Format | Jak rozpoznać |
|--------|--------------|
| PKO BP | Nagłówki: `Data operacji`, `Kwota`, `Opis transakcji` |
| CSV z nagłówkami | Pierwszy wiersz to tekst (nie liczby/daty) |
| CSV bez nagłówków | Wszystkie wiersze to dane — kolumny numerowane automatycznie |

### 3. Zmapuj kolumny i wybierz osobę (Krok 2)

Wskaż które kolumny zawierają:
- **Data operacji** *(wymagane)* — format `YYYY-MM-DD`
- **Kwota / Obciążenia** *(wymagane)* — kwota transakcji; ujemna = wydatek
- **Uznania** *(opcjonalne, iPKO)* — gdy bank rozbija wypływy i wpływy na dwie kolumny
- **Opis / Notatka** *(opcjonalne)* — używany później do kategoryzacji
- **Osoba** *(wymagane)* — domyślna osoba dla transakcji z tego wyciągu

Formaty PKO BP, Millennium i Revolut: kolumny są zmapowane automatycznie, opisy wyodrębniane z pól bankowych (Lokalizacja, Tytuł, Nazwa odbiorcy).

### 4. Zapisz do kolejki (Krok 2 → 3)

Kliknij **„Zapisz do kolejki →”**. Kreator (od #131) **nie kategoryzuje** —
zapisuje operacje do kolejki „Do rozliczenia” (`transakcje_dowody` w statusie
`nowy`, RPC `kolejka_dodaj`) i pokazuje podsumowanie:

- **Dodano do kolejki** — nowe operacje,
- **Pominięto** — już w kolejce, zaksięgowane albo wykluczone (ten sam odcisk),
- przycisk **„Przejdź do rozliczenia”**.

Co trafia do bazy dla każdej operacji:

| Pole | Skąd |
|---|---|
| `zrodlo`, `zrodlo_id` | format pliku i odcisk sha256 (`docs/DEDUP_TRANSAKCJI.md` §4) |
| `data`, `kwota_pelna` | z wyciągu, kwota ze znakiem przepływu |
| `opis` | opis wyodrębniony z pól banku, maks. 1000 znaków (kasowany przy zatwierdzeniu) |
| `osoba` | wybrana w kroku 2 |
| `kontrahent` | z aliasów `kontrahenci_aliasy`, rozpoznany na pełnym rachunku **w pamięci przeglądarki** |
| `surowe` | tylko 4 ostatnie cyfry kont, rodzaj operacji |
| `rachunek_hmac` | HMAC rachunku kontrahenta z `POST /api/v1/rachunki/hmac` |

**Pełny numer rachunku nie opuszcza przeglądarki** inaczej niż do endpointu
HMAC. Endpoint niedostępny (brak klucza, brak sieci) → operacja trafia do
kolejki bez `rachunek_hmac`.

Baza bez migracji kolejki → błąd „Baza nie ma migracji kolejki importu”;
kreator nie zapisuje transakcji inną ścieżką.

Kreator niczego nie trzyma w `localStorage`. Autozapis postępu sprzed #131
(klucz `csv_import_progress`) jest usuwany przy starcie aplikacji.

---

## Rozliczanie kolejki

Widok **„Do rozliczenia”** (przycisk z licznikiem w nagłówku, kod:
`src/components/kolejka/`, logika: `src/lib/csvImport/rozliczenie.js`).
Niedostępny offline. Gdy w kolejce są operacje z oglądanego miesiąca, widok
miesięczny pokazuje baner „N operacji z tego miesiąca czeka na rozliczenie —
sumy są niepełne”.

### Propozycje

Liczone **w przeglądarce, przy otwarciu widoku** — nic z nich nie trafia do
bazy przed zatwierdzeniem:

1. reguły użytkownika i wbudowany słownik (`categorizeDescription`),
   dopasowane do słownika gospodarstwa (`validateCategoryExists`);
2. parowanie (`parujPartie`): zobowiązania (kategoria + udział, np. `1/2`),
   podobne wpisy ręczne (podpowiedź „To ten sam wpis”), kontrahent po HMAC
   rachunku (aliasy haszowane tym samym endpointem);
3. AI (embeddingi) dla wierszy wciąż bez kategorii.

Domyślnie zaznaczone są wiersze z kategorią inną niż `Inne / Nieprzewidziane`.

### Edycja

- Kwota dowodu jest tylko do odczytu. **Udział** (`całość`, `1/2`, `4/6`)
  liczy kwotę transakcji z brutto i dopisuje ślad `[udział 1/2 z … zł]`.
- Data, opis (→ komentarz transakcji), kategoria, podkategoria i **osoba**
  (domyślnie z importu) są edytowalne.
- Filtry: status parowania, miesiąc, źródło. Panel „Reguły rozpoznawania”
  (reguły w bazie, wspólne dla urządzeń) stosuje nową regułę od razu.
- Edycje żyją tylko w pamięci widoku — **bez localStorage**. Wyjście z widoku
  z niezatwierdzonymi zmianami wymaga potwierdzenia.

### Akcje

| Akcja | Zapis |
|---|---|
| **Zatwierdź N** — zaznaczone i widoczne po filtrach | RPC `kolejka_zatwierdz` (nowa transakcja albo dołączenie do wpisu ręcznego, zamknięcie zobowiązania) |
| **Wyklucz** (transfer własny, zwrot, rozliczenie poza budżetem…) | `UPDATE status = 'wykluczony'` |
| Zakładka **Wykluczone → Przywróć** | `UPDATE status = 'nowy'` |

Operacja zatwierdzona albo wykluczona w międzyczasie na innym urządzeniu
(`pominieta`) to nie błąd: toast i odświeżenie listy, bez utraty edycji
pozostałych wierszy. Po zatwierdzeniu odświeżają się dane miesiąca, cache
roczny i licznik kolejki.

**Bezpieczeństwo:** opis z banku (tytuł przelewu wpisuje nadawca) jest
renderowany wyłącznie jako tekst — w `src/` nie ma `dangerouslySetInnerHTML`
(pilnuje tego test).

---

## Warstwy kategoryzacji (kolejność)

```
Opis transakcji
    │
    ▼
1. Reguły użytkownika (tabela reguly_rozpoznawania) — najwyższy priorytet
    │
    ▼
2. Wbudowane słowa kluczowe (~70 reguł)
    │
    ▼
3. AI — pgvector similarity search (jeśli VITE_OPENAI_API_KEY ustawiony)
    │
    ▼
Inne / Nieprzewidziane (brak dopasowania)
```

### Wbudowane słowa kluczowe

| Kategoria | Słowa kluczowe |
|-----------|---------------|
| Jedzenie / Zakupy domowe | biedronka, tesco, carrefour, makro, żabka, lidl, auchan |
| Jedzenie / Restauracje | mc donald, restauracja, pizza |
| Jedzenie / Kawa | kawa, starbucks |
| Transport / Paliwo | paliwo, bp, orlen |
| Transport / Komunikacja | pkp, metro, uber |
| Mieszkanie / Czynsz | mieszkanie, czynsz |
| Mieszkanie / Media | energa, pge, gaz, woda, internet, telefon |
| Zdrowie / Leki | apteka |
| Zdrowie / Lekarz | lekarz, szpital, dentyst |
| Rozrywka / Kino | kino |
| Rozrywka / Subskrypcje | spotify, netflix, hbo, amazon |
| Ubrania | h&m, zara, c&a, odzież |
| Dom / Wyposażenie | leroy merlin, jysk, ceneo |
| Inne / Fryzjer | fryzjer, salon, kosmetyk |
| Inne / Prezenty | prezent |

---

## Kategoryzacja AI — szczegóły techniczne

### Wymagania

- Rozszerzenie `pgvector` włączone w Supabase (Database → Extensions)
- Migracja `004_category_embeddings.sql` uruchomiona
- Zmienna `VITE_OPENAI_API_KEY` ustawiona w `.env`

### Architektura

```
CSVImport.jsx
    │  wywołuje
    ▼
src/services/categoryAI.js
    ├── generateEmbeddingsBatch()  →  POST api.openai.com/v1/embeddings
    │                                 model: text-embedding-3-small
    │                                 dims: 1536
    │
    ├── categorizeWithAI()         →  supabase.rpc('match_category_rules')
    │                                 cosine similarity > 0.78
    │
    ├── saveCategoryRule()         →  INSERT category_rules
    │   (przy dodaniu reguły)
    │
    └── saveCategoryRulesBatch()   →  INSERT category_rules (chunki po 20)
        (po udanym imporcie)
```

### Tabela `category_rules`

```sql
CREATE TABLE category_rules (
  id           UUID PRIMARY KEY,
  household_id UUID REFERENCES households,
  description  TEXT,
  embedding    vector(1536),  -- OpenAI text-embedding-3-small
  kategoria    TEXT,
  podkategoria TEXT,
  source       TEXT  -- 'manual' | 'import' | 'keyword'
);
```

Każde gospodarstwo (`household_id`) ma własne, izolowane reguły — chronione przez RLS.

### Jak rośnie baza wiedzy

| Zdarzenie | Co jest zapisywane |
|-----------|-------------------|
| Użytkownik dodaje regułę | 1 embedding dla wpisanego słowa kluczowego |
| Udany import | Embeddingi dla wszystkich skategoryzowanych transakcji |

Im więcej importów, tym trafniejsze dopasowania w kolejnych sesjach.

---

## Troubleshooting

**„Musisz zmapować kolumnę daty i kwoty"**
→ Wybierz odpowiednie kolumny w Kroku 2.

**Brak automatycznej kategoryzacji**
→ Dodaj regułę słowem kluczowym lub włącz AI ustawiając `VITE_OPENAI_API_KEY`.

**AI nie kategoryzuje transakcji**
→ Sprawdź czy `VITE_OPENAI_API_KEY` jest poprawny. Baza wektorowa musi zawierać wcześniej zapisane reguły — pierwsze importy kategoryzuje tylko system słów kluczowych.

**Błąd przy imporcie (pgvector)**
→ Upewnij się że rozszerzenie `vector` jest włączone w Supabase i że migracja `004_category_embeddings.sql` została uruchomiona.

**Format daty nieprawidłowy**
→ Data musi być w formacie `YYYY-MM-DD`. Aplikacja obsługuje format bankowy PKO BP automatycznie.
