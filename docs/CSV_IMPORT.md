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

### 3. Zmapuj kolumny (Krok 2)

Wskaż które kolumny zawierają:
- **Data operacji** *(wymagane)* — format `YYYY-MM-DD`
- **Kwota / Obciążenia** *(wymagane)* — kwota transakcji; ujemna = wydatek
- **Uznania** *(opcjonalne, iPKO)* — gdy bank rozbija wypływy i wpływy na dwie kolumny
- **Opis / Notatka** *(opcjonalne)* — używany do automatycznej kategoryzacji
- **Osoba** *(wymagane)* — kto wpisuje transakcje

Format PKO BP: kolumny są zmapowane automatycznie, opisy transakcji wyodrębniane z pól bankowych (Lokalizacja, Tytuł, Nazwa odbiorcy).

### 4. Przejrzyj i edytuj (Krok 3)

- Każde pole jest edytowalne inline (data, kwota, opis, kategoria, podkategoria)
- Transakcje bez przypisanej kategorii są wyróżnione żółtym tłem
- Kliknij ✕ aby usunąć transakcję z importu
- Przycisk „Szczegóły CSV" pokazuje oryginalne pola z pliku

#### Kategoryzacja AI

Jeśli ustawiony jest `VITE_OPENAI_API_KEY`, po przejściu do tego kroku aplikacja automatycznie:
1. Generuje embeddingi dla wszystkich nieprzypisanych transakcji (jedno batch API call)
2. Wyszukuje podobne opisy w bazie wektorowej `category_rules`
3. Przypisuje kategorie z wynikiem podobieństwa ≥ 0,78

Wynik widoczny w banerem „AI automatycznie przypisało X transakcji".

### 5. Importuj (Krok 3 → 4)

Kliknij **„Importuj N transakcji"** — batch insert do Supabase.

Po udanym imporcie:
- Kategorie wszystkich transakcji są zapisywane w bazie wektorowej jako wzorce do przyszłych importów
- Dane natychmiast pojawiają się w głównym widoku aplikacji

---

## Reguły rozpoznawania

Panel w Kroku 3 pozwala zarządzać regułami słów kluczowych:

### Dodawanie reguły

1. Kliknij **„+ Dodaj regułę"**
2. Wpisz fragment tekstu który pojawia się w opisach transakcji (np. `Allegro`, `PKO Leasing`)
3. Wybierz typ, kategorię i podkategorię
4. Kliknij **„Dodaj i zastosuj"**

Reguła jest:
- Natychmiast stosowana do wszystkich nieprzypisanych transakcji w bieżącym imporcie
- Zapisywana do `localStorage` — aktywna w kolejnych importach
- Przy włączonym AI — zapisywana również jako embedding w Supabase `category_rules`

### Przeglądanie reguł

Kliknij **„Lista reguł"** aby zobaczyć i usunąć zapisane reguły.

---

## Warstwy kategoryzacji (kolejność)

```
Opis transakcji
    │
    ▼
1. Reguły użytkownika (localStorage) — najwyższy priorytet
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

## Auto-zapis postępu

Podczas edycji (Krok 3) postęp jest automatycznie zapisywany do `localStorage`. Przy ponownym otwarciu importu pojawi się pytanie czy przywrócić poprzednią sesję (ważna przez 24 h).

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
