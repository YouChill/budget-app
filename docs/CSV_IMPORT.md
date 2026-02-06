# Import Transakcji z CSV

## Opis funkcjonalności

Funkcja umożliwia masowy import transakcji z pliku CSV, co eliminuje konieczność ręcznego wpisywania każdej operacji z wyciągu bankowego.

## Jak używać

### 1. Przygotowanie pliku CSV

Plik CSV powinien zawierać:
- Nagłówki kolumn (np. "Data", "Kwota", "Opis")
- Dane w formacie:
  - **Data**: `YYYY-MM-DD` (np. `2024-01-15`)
  - **Kwota**: liczba, gdzie ujemne = wydatek, dodatnie = przychód
  - **Opis**: nazwa transakcji (opcjonalnie, ale zalecane do automatycznej kategoryzacji)

**Przykład CSV:**
```
Data,Kwota,Opis
2024-01-15,-100,Biedronka
2024-01-16,-50,Starbucks
2024-01-17,3000,Wynagrodzenie Mąż
```

### 2. Otwarcie dialogu importu

1. Kliknij przycisk **↓** (upload) w nagłówku aplikacji
2. Lub użyj menu ustawień i wybierz opcję importu CSV

### 3. Mapowanie kolumn

Po wybraniu pliku, wskaż które kolumny zawierają:
- **Data operacji** * (wymagana) - w formacie YYYY-MM-DD
- **Kwota** * (wymagana) - kwota transakcji
- **Opis/Notatka** (opcjonalna) - używana do automatycznej kategoryzacji

### 4. Podgląd i edycja

Przed importem widać podgląd wszystkich transakcji:
- ✅ Możesz edytować każde pole
- ✅ Możesz zmienić kategorię i podkategorię
- ✅ Możesz usunąć transakcje z importu (kliknij ✕)
- ✅ Kategorie są automatycznie przypisywane na podstawie opisu

### 5. Potwierdzenie importu

Kliknij **Importuj transakcje** - wszystkie transakcje zostaną dodane do arkusza w jednej operacji (batch).

## Automatyczna kategoryzacja

Aplikacja automatycznie przypisuje kategorie na podstawie słów kluczowych w opisie:

### Jedzenie
- "biedronka", "tesco", "carrefour", "makro", "żabka", "lidl", "auchan" → **Jedzenie / Zakupy domowe**
- "mc donald", "restauracja", "pizza" → **Jedzenie / Restauracje/miasto**
- "kawa", "starbucks" → **Jedzenie / Kawa/przekąski**

### Transport
- "paliwo", "bp", "orlen" → **Transport / Paliwo**
- "pkp", "metro", "uber" → **Transport / Komunikacja miejska**

### Mieszkanie
- "energa", "pge" → **Mieszkanie / Prąd**
- "gaz" → **Mieszkanie / Gaz**
- "internet" → **Mieszkanie / Internet**
- "woda" → **Mieszkanie / Woda**

### Zdrowie
- "apteka" → **Zdrowie / Leki**
- "lekarz", "szpital", "dentyst" → **Zdrowie / Lekarz**

### Rozrywka
- "kino" → **Rozrywka / Kino/koncerty**
- "spotify", "netflix", "hbo", "amazon" → **Rozrywka / Subskrypcje**

### Ubrania
- "h&m", "zara", "c&a", "odzież" → **Ubrania / Dorośli**

### Dom
- "leroy merlin", "jysk", "ceneo" → **Dom / Wyposażenie**

### Inne
- "fryzjer", "salon", "kosmetyk" → **Inne / Fryzjer/kosmetyki**
- "prezent" → **Inne / Prezenty**

## Architektura rozwiązania

### Frontend - komponenty React

**`CSVImport.jsx`** - główny komponent importu
- Krok 1: Upload pliku CSV
- Krok 2: Mapowanie kolumn
- Krok 3: Podgląd i edycja transakcji
- Krok 4: Potwierdzenie sukcesu

Funkcje pomocnicze:
- `categorizeDescription()` - przypisuje kategorię na podstawie opisu
- `Papa.parse()` - parsowanie CSV (biblioteka Papaparse)

### Backend - Google Apps Script

**Nowy endpoint: `addTransakcjeBatch`**

Zarządza batch importem:
```javascript
addTransakcjeBatch(transakcje: Array<Transakcja>) 
  → { success: bool, count: number, ids: Array, message: string }
```

Cechy:
- ✅ Walidacja każdej transakcji
- ✅ Operacja atomowa - albo wszystkie się dodają, albo żadna
- ✅ Obsługa błędów z szczegółami
- ✅ Generowanie UUID dla każdej transakcji
- ✅ Efektywne dodawanie (batch insert zamiast append loop)

## Obsługiwane formaty dat

- ISO format: `2024-01-15`
- Format z myślnikami: `2024-01-15`

> Format czasu UTC bez strefy czasowej - aplikacja automatycznie konwertuje do strefy Europe/Warsaw

## Walidacja danych

Podczas importu sprawdzane są:
1. ✅ Typ transakcji (Wydatek/Przychód)
2. ✅ Data w poprawnym formacie i prawidłowa (np. 31 lutego nie istnieje)
3. ✅ Kwota > 0 i numeryczna
4. ✅ Kategoria nie pusta

Transakcje które nie przejdą walidacji są omijane z komunikatem błędu.

## Przykładowe exporty z banków

### PKO BP
Eksportuj wyciąg → wybierz format CSV → kolumny: Data, Opis, Kwota

### ING Bank
Wyciąg → Pobierz → CSV

### mBank
Historia operacji → Pobierz raport → CSV

## Ograniczenia i uwagi

- Maksymalnie rekomendowany rozmiar pliku: 10 MB (~10 000 transakcji)
- Format daty musi być: **YYYY-MM-DD**
- Kwota ujemna = wydatek, dodatnia = przychód
- Po imporcie dane pojawiają się natychmiast w aplikacji
- Każda transakcja otrzymuje unikalny ID (UUID)

## Rozwijanie funkcjonalności

### Dodawanie nowych reguł kategoryzacji

Edytuj obiekt `categoryMapping` w `CSVImport.jsx`:
```javascript
const categoryMapping = {
  'słowo_kluczowe': { kategoria: 'Nazwa Kategorii', podkategoria: 'Podkategoria' },
  // ...
};
```

### Obsługa dodatkowych formatów dat

Rozszerz funkcję `prepareTransactions()` w `CSVImport.jsx`.

## Troubleshooting

### Błąd: "Musisz zmapować kolumnę daty i kwoty"
→ Wybierz kolumny zawierające datę i kwotę w sekcji mapowania

### Błąd: "Data nie jest w formacie YYYY-MM-DD"
→ Upewnij się że data jest w formacie `2024-01-15`

### Błąd: "Kwota musi być liczbą"
→ Sprawdź czy kwota nie zawiera liter lub specjalnych znaków (oprócz . lub ,)

### Brak automatycznej kategoryzacji
→ Dodaj słowo kluczowe do obiektu `categoryMapping`
→ Lub ręcznie wybierz kategorię w podglądzie przed importem

## Bezpieczeństwo

- Plik CSV jest przetwarzany lokalnie w przeglądarce (Papaparse)
- Walidacja danych odbywa się zarówno na frontend jak i backend
- Każdy import loguje transakcje z UUID dla audytu
- Brak przechowywania oryginalnych plików CSV
