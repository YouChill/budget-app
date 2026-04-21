# Budżet Domowy

Aplikacja do śledzenia domowych wydatków i przychodów. Stworzona z myślą o wspólnym zarządzaniu finansami przez pary/rodziny.

![React](https://img.shields.io/badge/React-19-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC)
![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E)
![OpenAI](https://img.shields.io/badge/AI-OpenAI-412991)

## Funkcjonalności

- **Dashboard** — podsumowanie miesiąca (przychody, wydatki, bilans)
- **Dodawanie i edycja transakcji** — z kategorią, podkategorią, osobą i komentarzem
- **Nawigacja miesięczna** — przeglądanie różnych miesięcy
- **Usuwanie transakcji** — swipe na mobile lub przycisk
- **Wieloosobowe** — oznaczanie kto wprowadził transakcję
- **Autoryzacja Google OAuth 2.0** — logowanie kontem Google z weryfikacją JWT
- **Synchronizacja** — dane w Supabase (PostgreSQL), dostępne z każdego urządzenia
- **Real-time sync** — automatyczna aktualizacja danych między urządzeniami w czasie rzeczywistym
- **Wykresy** — wykresy kołowe i słupkowe wydatków wg kategorii (Recharts)
- **Import CSV z AI** — import wyciągów bankowych z automatycznym dopasowaniem kategorii opartym na wektorowej bazie wiedzy (OpenAI + pgvector)
- **Budżety** — ustawianie miesięcznych limitów wydatków wg kategorii (z powtarzalnością roczną/miesięczną)
- **Podsumowanie roczne** — KPI roczne, wykresy miesięczne przychody vs wydatki, oszczędności skumulowane, porównanie rok do roku, podział wydatków na osoby
- **Offline mode** — kolejka operacji offline z automatyczną synchronizacją po powrocie do sieci

## Stack technologiczny

- **Frontend:** React 19 + Vite 6
- **Stylowanie:** Tailwind CSS 4
- **Wykresy:** Recharts
- **Import CSV:** PapaParse
- **Obsługa gestów:** react-swipeable
- **Autoryzacja:** Google OAuth 2.0 + Supabase Auth
- **Backend:** Supabase (PostgreSQL + PostgREST API)
- **AI / embeddingi:** OpenAI `text-embedding-3-small` + Supabase pgvector
- **Real-time:** Supabase Realtime (WebSocket)
- **Hosting:** Netlify / Vercel (opcjonalnie)

## Wymagania

- Node.js 18+
- Konto Supabase (baza danych PostgreSQL)
- Konto Google (do autoryzacji OAuth logowania)
- Klucz OpenAI API *(opcjonalnie — do kategoryzacji AI)*

## Instalacja

### 1. Sklonuj repozytorium

```bash
git clone https://github.com/YouChill/budget-app.git
cd budget-app
```

### 2. Zainstaluj zależności

```bash
npm install
```

### 3. Skonfiguruj zmienne środowiskowe

```bash
cp .env.example .env
```

Uzupełnij plik `.env`:

```env
VITE_SUPABASE_URL=https://twoj-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=twoj-anon-key
VITE_HOUSEHOLD_ID=twoj-household-uuid

# Opcjonalnie — włącza kategoryzację AI podczas importu CSV
VITE_OPENAI_API_KEY=sk-...
```

Szczegółowa instrukcja Supabase: [docs/SETUP_SUPABASE.md](./docs/SETUP_SUPABASE.md)

### 4. Uruchom migracje bazy danych

W panelu Supabase → SQL Editor uruchom kolejno:

```
migration/001_create_budzety.sql
migration/002_rls_policies_phase2.sql
migration/003_authentication_phase3.sql
migration/004_category_embeddings.sql   ← pgvector + AI kategoryzacja
migration/005_email_password_auth.sql   ← Supabase Auth email+hasło
```

> Przed uruchomieniem migracji 004 włącz rozszerzenie **pgvector** w Supabase Dashboard → Database → Extensions.

### 5. Skonfiguruj autoryzację (Supabase Auth — email + hasło)

W Supabase Dashboard:
- **Authentication → Providers → Email**: *Enable email signup: ON*, *Confirm email: ON*.
- **Authentication → Providers → Google**: *OFF* (nie używamy).

Szczegółowa instrukcja: [docs/SETUP_AUTH_PHASE3.md](./docs/SETUP_AUTH_PHASE3.md)

### 6. Uruchom lokalnie

```bash
npm run dev
```

Aplikacja dostępna pod adresem: `http://localhost:5173`

## Import CSV

### Obsługiwane formaty

| Format | Detekcja |
|--------|----------|
| **PKO BP** | Automatyczna — kolumny `Data operacji`, `Kwota`, `Opis transakcji` |
| **CSV z nagłówkami** | Automatyczna — dowolne banki z nagłówkami kolumn |
| **CSV bez nagłówków** | Ręczne mapowanie kolumn |

### Jak działa import

1. **Prześlij plik** — przeciągnij plik CSV na strefę drop lub kliknij „Wybierz plik z dysku"
2. **Zmapuj kolumny** — wskaż kolumny daty, kwoty i opisu (PKO BP: automatycznie)
3. **Przejrzyj transakcje** — edytuj kategorie, usuń zbędne wiersze
4. **Importuj** — batch insert do Supabase

### Kategoryzacja — trzy warstwy

```
Opis transakcji
    │
    ▼
1. Reguły użytkownika (słowa kluczowe, najwyższy priorytet)
    │
    ▼
2. Wbudowane słowa kluczowe (~70 reguł: Biedronka, Orlen, Netflix…)
    │
    ▼
3. AI (pgvector similarity search w bazie historycznych kategoryzacji)
    │
    ▼
Kategoria / Podkategoria
```

### Kategoryzacja AI (pgvector + OpenAI)

Gdy ustawiony jest klucz `VITE_OPENAI_API_KEY`:

- Po przejściu do kroku podglądu aplikacja generuje embeddingi dla wszystkich nieprzypisanych transakcji (batch API call) i wyszukuje podobne opisy w bazie wektorowej `category_rules`
- Reguły są zapisywane do bazy przy każdym ręcznym dodaniu reguły oraz po udanym imporcie
- Baza wiedzy rośnie z każdym importem — kolejne importy kategoryzują się coraz trafniej
- Próg podobieństwa: **0.78** (cosine similarity)
- Model embeddingów: `text-embedding-3-small` (1536 wymiarów)

Bez klucza OpenAI import działa normalnie — aktywne są warstwy 1 i 2.

### Reguły rozpoznawania

W kroku podglądu panel „Reguły rozpoznawania" pozwala:
- Dodać regułę słowem kluczowym → natychmiast przypisuje pasujące nieprzypisane transakcje
- Przeglądać i usuwać zapisane reguły
- Przy włączonym AI — reguła jest jednocześnie zapisywana jako embedding w Supabase

## Struktura projektu

```
budget-app/
├── src/
│   ├── App.jsx                  # Główna aplikacja React
│   ├── main.jsx                 # Punkt wejścia
│   ├── components/
│   │   ├── LoginPage.jsx        # Strona logowania Google OAuth
│   │   ├── TransactionForm.jsx  # Formularz transakcji
│   │   ├── TransactionItem.jsx  # Pojedyncza transakcja (swipe)
│   │   ├── YearlySummary.jsx    # Podsumowanie roczne z wykresami
│   │   └── OfflineBanner.jsx    # Banner trybu offline
│   ├── contexts/
│   │   └── AuthContext.jsx      # Kontekst autoryzacji (JWT)
│   ├── hooks/
│   │   └── useOffline.js        # Hook offline mode
│   ├── lib/
│   │   └── supabase.js          # Klient Supabase
│   ├── services/
│   │   ├── api.js               # API do Supabase
│   │   ├── categoryAI.js        # Embeddingi OpenAI + pgvector
│   │   └── offlineQueue.js      # Kolejka offline operations
│   └── utils/
│       └── calculations.js      # Obliczenia finansowe
├── components/
│   ├── CSVImport.jsx            # Import CSV (drag-and-drop + AI)
│   ├── CategoryCharts.jsx       # Wykresy kategorii (Recharts)
│   └── Budgets.jsx              # Zarządzanie budżetami
├── migration/
│   ├── 001_create_budzety.sql
│   ├── 002_rls_policies_phase2.sql
│   ├── 003_authentication_phase3.sql
│   └── 004_category_embeddings.sql   # pgvector + category_rules
├── docs/
│   ├── SETUP_SUPABASE.md
│   ├── SETUP_AUTH_PHASE3.md
│   └── CSV_IMPORT.md
├── public/
├── index.html
├── package.json
├── vite.config.js
└── .env.example
```

## Struktura bazy danych

### transakcje
| Pole | Typ | Opis |
|------|-----|------|
| id | UUID | Klucz główny |
| household_id | UUID | Gospodarstwo |
| data | DATE | Data transakcji |
| typ | TEXT | `Wydatek` lub `Przychód` |
| kwota | NUMERIC | Kwota w PLN |
| kategoria | TEXT | Kategoria |
| podkategoria | TEXT | Podkategoria |
| osoba | TEXT | Osoba wpisująca |
| komentarz | TEXT | Notatka |

### category_rules *(nowa — AI)*
| Pole | Typ | Opis |
|------|-----|------|
| id | UUID | Klucz główny |
| household_id | UUID | Gospodarstwo |
| description | TEXT | Opis transakcji |
| embedding | vector(1536) | Embedding OpenAI |
| kategoria | TEXT | Przypisana kategoria |
| podkategoria | TEXT | Przypisana podkategoria |
| source | TEXT | `manual` / `import` / `keyword` |

### kategorie
| Pole | Typ |
|------|-----|
| id | UUID |
| household_id | UUID |
| typ | TEXT |
| kategoria | TEXT |
| podkategoria | TEXT |

### osoby
| Pole | Typ |
|------|-----|
| id | UUID |
| household_id | UUID |
| nazwa | TEXT |

### budzety
| Pole | Typ |
|------|-----|
| id | UUID |
| household_id | UUID |
| kategoria | TEXT |
| limit_kwota | NUMERIC |
| miesiac | INTEGER |
| rok | INTEGER |
| zakres | TEXT |

## Zmienne środowiskowe

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `VITE_SUPABASE_URL` | ✅ | URL projektu Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Klucz anonimowy Supabase |
| `VITE_HOUSEHOLD_ID` | ⚠️ | UUID gospodarstwa (fallback bez auth) |
| `VITE_OPENAI_API_KEY` | ➕ | Klucz OpenAI — włącza kategoryzację AI |

## Deployment

### Netlify / Vercel

1. Zbuduj aplikację: `npm run build`
2. Połącz repozytorium z Netlify lub Vercel
3. Ustaw wszystkie zmienne środowiskowe w ustawieniach projektu
4. Dodaj domenę do **Authorized JavaScript origins** w Google Cloud Console i do **Allowed URLs** w Supabase

## Roadmap

- [x] MVP — dodawanie/usuwanie/edycja transakcji
- [x] Podsumowanie miesiąca
- [x] Autoryzacja Google OAuth 2.0
- [x] Migracja na Supabase (PostgreSQL)
- [x] Wykresy kategorii (kołowe i słupkowe)
- [x] Import CSV z automatyczną kategoryzacją
- [x] Budżetowanie (plan vs realizacja)
- [x] Offline mode z offline queue
- [x] Zarządzanie słownikami w aplikacji
- [x] Real-time subscriptions
- [x] Podsumowanie roczne z porównaniem lat i podziałem na osoby
- [x] Kategoryzacja AI — pgvector + OpenAI embeddingi
- [x] Drag-and-drop upload z nowym UX importu CSV
- [ ] Eksport danych do CSV (backup)
- [ ] Integracje bankowe (Open Banking API)
- [ ] Raporty szczegółowe PDF
- [ ] Wiele gospodarstw (multi-household)

## Licencja

MIT
