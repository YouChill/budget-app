# Rozpoznawanie już zaksięgowanych operacji

Analiza z 2026-10-11 i stan jej wdrożenia. Źródłem prawdy dla schematu jest
`migration/014_dowody_i_zobowiazania.sql`. Dla odcisków jest nim
`src/lib/odciski.js`, a dla parowania `src/lib/parowanie.js`.

## Stan wdrożenia

| Etap z planu | Stan | Gdzie |
|---|---|---|
| 1. Migracja 014 + RPC + testy SQL | ✅ | `migration/014_…sql`, `rollback_014.sql`, `migration/tests/` |
| 2. `CSVImport.jsx` na RPC + podgląd „już zaksięgowane” | ✅ | `components/CSVImport.jsx`, `src/services/api.js` |
| 3. Tabela `zobowiazania` + endpoint API | ✅ | `api/v1/[...route].js`, `docs/API.md` |
| 4. Radar Gmail: zapis i odczyt zobowiązań | ⏳ poza repo | korzysta z `POST/PATCH /api/v1/zobowiazania` |
| 5. Backfill `kwota_pelna`/`udzial` + data graniczna | ✅ | backfill w 014; data graniczna — patrz §7 |

Wdrożenie: uruchom `014_dowody_i_zobowiazania.sql` w SQL Editorze Supabase
**przed** deployem frontu i API. `GET /api/v1/transakcje` czyta już nowe
kolumny. Front bez migracji działa dalej: podgląd ostrzega „nie sprawdzono
duplikatów” i zapisuje starą ścieżką.

Po migracji uzupełnij `kontrahenci_aliasy` (rachunki PWiK, Play, TAURON,
wzorzec `APPLE.COM/BILL`…). Bez aliasów działa tylko krok 2 kaskady, czyli
numer dokumentu w tytule.

### Odstępstwa od planu

- **Parowanie w JS, zapis w SQL.** Plan zakładał całą kaskadę w
  `importuj_transakcje`. UI musi jednak pokazać wynik parowania *przed*
  zapisem, a testy z §8 są w Vitest. Kaskada żyje więc w
  `src/lib/parowanie.js`, wspólnym dla UI, API i skryptów. RPC robi
  atomowy zapis: dowody `ON CONFLICT DO NOTHING`, transakcje tylko dla
  nowych dowodów i zamknięcie zobowiązań. Logika zapisu jest jedna, tak jak
  chciał plan.
- **`istniejace_odciski(zrodlo, ids[])`** — dodatkowe RPC. 500 odcisków
  sha256 nie mieści się w URL zapytania `?zrodlo_id=in.(…)`.
- **`zobowiazania.data_wystawienia`.** Okno przelewu `[wystawienie, termin + 10]`
  potrzebuje daty wystawienia. Bez niej przyjmujemy `termin − 30`.
- **Zobowiązanie opłacone mailem nadal czeka na bank.** Status `oplacone` bez
  `transakcja_id` (dowód wpłaty z maila) bierze udział w parowaniu. Wiersz z
  wyciągu dostaje wtedy kategorię i udział, a zobowiązanie — transakcję.
  Bez tego potwierdzenie wpłaty „PWIK - Podziękowanie” blokowałoby
  podpowiedź dla wyciągu.
- **FK `(transakcja_id, household_id)`.** Dowód i zobowiązanie mogą wskazać
  tylko transakcję z tego samego gospodarstwa. Zwykły FK omija RLS, więc dałoby
  się podpiąć cudze UUID. `ON DELETE SET NULL (transakcja_id)` wymaga PG 15+.
- **Źródło `csv`** dla plików z ręcznym mapowaniem kolumn. Odcisk liczony jest z
  daty, kwoty, opisu i salda (jeśli plik je ma). Identyczne wiersze w jednym pliku
  dostają sufiks `#2`, `#3`.
- **Wykrywanie formatu Revolut** w `CSVImport.jsx`. Operacje `PENDING` są
  pomijane: nie mają salda, więc po zaksięgowaniu dostałyby inny odcisk.
- **„Do weryfikacji” bez kontrahenta tylko przy zgodnej kwocie.** Plan każe
  oznaczać tak każdy wiersz bez kontrahenta. To byłby co drugi zakup kartą,
  więc oznaczamy tylko wtedy, gdy kwota pasuje do otwartego zobowiązania
  w jego oknie.
- **Strażnik znaku** siedzi w `validateCategoryExists()`, a nie
  w `categorizeDescription()`. Ten drugi już pomijał wbudowany słownik dla
  przychodów, ale reguły bez `typ` nadal dawały przychodowi kategorię
  wydatkową. Para spoza słownika przychodów trafia teraz do
  `Inne przychody / Rozliczenia rodzinne`, jeśli tytuł wskazuje rodzinę,
  a w pozostałych przypadkach do `Inne przychody / Zwroty`.

## 1. Problem

To samo zdarzenie finansowe dociera do aplikacji z kilku źródeł:

| Źródło | Co widzi | Data | Kwota |
|---|---|---|---|
| Radar Gmail | fakturę / odnowienie / potwierdzenie wpłaty | wystawienia, terminu, odnowienia | brutto z dokumentu |
| Wyciąg Millennium / PKO / Revolut | faktyczny przepływ | transakcji (0–5 dni po zdarzeniu) | brutto z konta |
| Allegro | zamówienie, grupę płatności | zamówienia | po kuponie / pełna |
| Wpis ręczny | cokolwiek | dowolna | często już po podziale |

Przed 014 nic tych źródeł nie łączyło. Ponowne wgranie wyciągu podwajało
miesiąc. Dopasowanie „po kwocie” utrudniają dwie rzeczy: podział z rodzicami
(w bazie 1/2 albo 4/6 kwoty z banku) i przesunięcie dat (termin faktury vs data
księgowania).

## 2. Zasada

> Wydatkiem jest pieniądz, który wyszedł z konta (skill `rozliczenia-budzetu`).

- **Bank jest źródłem prawdy** dla daty i kwoty wydatku.
- **Mail jest dowodem i podpowiedzią.** Daje numer dokumentu, wystawcę
  i kategorię. Sam nie tworzy wydatku.
- Każda operacja ma **odcisk** (stabilny identyfikator w obrębie źródła), a
  jedna transakcja może mieć **wiele dowodów** z różnych źródeł.

## 3. Model danych (wariant B + C)

- `transakcje.kwota_pelna`, `transakcje.udzial` — kwota przed podziałem i klucz.
- `transakcje_dowody` — `UNIQUE (household_id, zrodlo, zrodlo_id)`. Dowód bez
  transakcji to „poczekalnia”. Usunięcie transakcji zostawia dowód, więc wyciąg
  dalej jest rozpoznawany jako wgrany. Jeśli zaznaczysz taki wiersz w podglądzie,
  zostanie dodany ponownie (`wymus`).
- `zobowiazania` — `UNIQUE (household_id, kontrahent, dokument)`, status
  `otwarte | oplacone | anulowane`.
- `kontrahenci_aliasy` — `typ_wzorca ∈ {rachunek, opis}`, wspólny dla radaru
  i importu.

RLS na wszystkich trzech tabelach jest taki sam jak na `transakcje`
(gospodarstwo z `profiles`).

## 4. Odciski per źródło

Odcisk to `sha256` (hex) ze znormalizowanych pól połączonych `|`. Normalizacja:
w numerach kont zostają same cyfry, kwota jest liczona w groszach na tekście
(nie na float) i zapisywana z dwoma miejscami, a opis jest wielkimi literami,
z pojedynczymi spacjami.

| Źródło | Pola odcisku | Uwagi |
|---|---|---|
| Millennium | `nr_rachunku` · `data_transakcji` · `obciazenia/uznania` · `saldo` · `opis` | Saldo rozróżnia dwa identyczne zakupy tego samego dnia. `Data rozliczenia` pominięta, bo zmienia się między eksportami. |
| PKO BP | `data_operacji` · `kwota` · `saldo po transakcji` · `opis` (wszystkie kolumny opisu) | |
| Revolut | `Started Date` · `Amount` · `Balance` · `Description` | tylko `COMPLETED` |
| CSV (ręczne mapowanie) | `data` · `kwota` · `saldo` (jeśli jest) · `opis` | powtórzenia w pliku: `#2`, `#3` |
| Gmail | `kontrahent|dokument` | **Nie** `messageId` — ta sama faktura bywa wysłana dwa razy. |
| Allegro | `payment.id|order.id` | |
| Ręczne | brak | Zawsze nowe. |

**Zmiana normalizacji unieważnia zapisane odciski.** Rób ją tylko razem
z migracją przeliczającą `zrodlo_id`.

Kolumna `surowe` w dowodach przechowuje tylko 4 ostatnie cyfry numerów kont
(test w `CSVImport.dedup.test.jsx`).

## 5. Parowanie (kaskada)

Dla każdego wiersza wyciągu (`src/lib/parowanie.js`):

1. **Odcisk istnieje** → „Już zaksięgowane”, domyślnie odznaczone.
2. **Numer dokumentu w tytule / opisie** (min. 5 znaków, bez spacji) →
   połączenie z zobowiązaniem.
3. **Kontrahent + kwota brutto + okno dat** → połączenie, jeśli kandydat jest
   **dokładnie jeden**.
   - Kontrahenta rozpoznajemy po końcówce numeru rachunku (min. 10 cyfr), a
     przy płatnościach kartą po aliasie opisu.
   - Okno dla przelewu to `[wystawienie, termin + 10]`, a dla `auto_karta`
     `[odnowienie − 1, odnowienie + 4]`.
4. **Wielu kandydatów** albo **brak kontrahenta przy zgodnej kwocie** →
   „Do weryfikacji”, bez połączenia. Gdy dwa wiersze partii wskazują to samo
   zobowiązanie, oba trafiają do weryfikacji.
5. **Podobny wpis bez dowodu** (data ±2 dni, kwota = brutto, udział z
   zobowiązania, 1/2 albo 4/6) → ostrzeżenie. Użytkownik wybiera „Dodaj jako
   nową”, „To ten sam wpis — tylko zapisz dowód” (`transakcja_id`, bez nowej
   transakcji) albo „Pomiń”.

Przychody nigdy nie łączą się z zobowiązaniami. Połączony wiersz dostaje
kategorię z zobowiązania. Jeśli jest udział, dostaje też kwotę udziału
(`ROUND_HALF_UP` na groszach) i ślad `[udział 1/2 z 119,98 zł]` w opisie.

## 6. Zapis

Wszystkie ścieżki wysyłają płaskie rekordy, które
`src/lib/importPozycje.js` zamienia na pozycje RPC:

- **UI** → `api.importujTransakcje()` → `importuj_transakcje`
- **API** → `POST /api/v1/transakcje` z `zrodlo_id` → `importuj_transakcje`
- **Skrypt** → `migration/import_do_aplikacji.mjs` → `importuj_transakcje`.
  Pytanie „w oknie są transakcje, kontynuować?” zostało tylko dla rekordów
  bez odcisku.

RPC zwraca `{dodane, pominiete, polaczone, dolaczone, do_weryfikacji, wyniki}`.

## 7. Dane historyczne

Starych wierszy z banku nie da się odcisnąć — `saldo` nie było zapisywane.
Zamiast konfigurowanej daty granicznej działa krok 5 kaskady. Każda
transakcja **bez dowodu** (ręczna albo sprzed 014) jest kandydatem do
ostrzeżenia „możliwy duplikat”. Od pierwszego importu po migracji obowiązuje
ścisły dedup po odciskach, a dla starszych danych — miękkie ostrzeżenie.

Ponowne wgranie archiwalnych wyciągów w trybie „tylko dowody” (opcja 2
z analizy) działa przez RPC: pozycja z `dowod` i `transakcja_id`, bez
`transakcja`. Nie ma do tego jeszcze UI ani skryptu.

## 8. Testy

- Vitest: `src/lib/__tests__/dedup.test.js` (odciski, kaskada, udział),
  `components/__tests__/CSVImport.test.js` (strażnik znaku, rekordy importu),
  `components/__tests__/CSVImport.dedup.test.jsx` (przepływ w komponencie),
  `api/__tests__/api-v1.test.js` (idempotentny POST, `/zobowiazania`).
- SQL: `migration/tests/run_sql_tests.sh` na lokalnym PostgreSQL 15+.
  Uruchamia atrapę Supabase, backfill, dedup, zobowiązania, izolację
  gospodarstw, idempotencję migracji i rollback.

  ```bash
  PGHOST=/run/postgresql PGUSER=postgres bash migration/tests/run_sql_tests.sh
  ```

## 9. Radar Gmail — co zostało

- Zapis zobowiązań: `POST /api/v1/zobowiazania` (upsert po kontrahencie
  i dokumencie, z kwotą, terminem, sposobem i podpowiedzią kategorii oraz udziału).
- Status: `GET /api/v1/zobowiazania?status=oplacone`. Dla opłaconych zdejmij
  etykietę „Rachunki/Do zapłaty”.
- Dowód wpłaty z maila: `PATCH /api/v1/zobowiazania/:id {"status":"oplacone"}`.
  Transakcji nie tworzy — utworzy ją wyciąg, a parowanie nadal ją znajdzie.
- Uwierzytelnienie bez nadzoru: token zwykłego użytkownika (RLS) wymaga
  odświeżania. Alternatywą jest Supabase MCP z jawnym `household_id`, które
  omija RLS. Decyzja jest otwarta.
