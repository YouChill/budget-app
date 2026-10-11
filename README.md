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
- **Autoryzacja email + hasło** — natywny Supabase Auth (rejestracja, logowanie, reset hasła) z weryfikacją sesji JWT
- **Synchronizacja** — dane w Supabase (PostgreSQL), dostępne z każdego urządzenia
- **Real-time sync** — automatyczna aktualizacja danych między urządzeniami w czasie rzeczywistym
- **Wykresy** — wykresy kołowe i słupkowe wydatków wg kategorii (Recharts)
- **Import CSV z AI** — import wyciągów bankowych z automatycznym dopasowaniem kategorii opartym na wektorowej bazie wiedzy (OpenAI + pgvector)
- **Budżety** — ustawianie miesięcznych limitów wydatków wg kategorii (z powtarzalnością roczną/miesięczną)
- **Podsumowanie roczne** — KPI roczne, wykresy miesięczne przychody vs wydatki, oszczędności skumulowane, porównanie rok do roku, podział wydatków na osoby
- **Offline mode** — kolejka operacji offline z automatyczną synchronizacją po powrocie do sieci
- **REST API** — pełny CRUD (`/api/v1`) dla transakcji, kategorii, osób i budżetów z autoryzacją JWT i izolacją gospodarstw ([dokumentacja](./docs/API.md))

## Stack technologiczny

- **Frontend:** React 19 + Vite 6
- **Stylowanie:** Tailwind CSS 4
- **Wykresy:** Recharts
- **Import CSV:** PapaParse
- **Obsługa gestów:** react-swipeable
- **Autoryzacja:** Supabase Auth (email + hasło)
- **Backend:** Supabase (PostgreSQL + PostgREST API)
- **AI / embeddingi:** OpenAI `text-embedding-3-small` + Supabase pgvector
- **Real-time:** Supabase Realtime (WebSocket)
- **Hosting:** Netlify / Vercel (opcjonalnie)

## Wymagania

- Node.js 18+
- Konto Supabase (baza danych PostgreSQL + Auth)
- Klucz OpenAI API *(opcjonalnie — do kategoryzacji AI, ustawiany po stronie serwera)*

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

# Opcjonalnie — kategoryzacja AI podczas importu CSV.
# Klucz OpenAI pozostaje WYŁĄCZNIE po stronie serwera (bez prefiksu VITE_):
OPENAI_API_KEY=sk-...
# Flaga widoczna w przeglądarce — włącz gdy OPENAI_API_KEY jest ustawiony:
VITE_AI_ENABLED=true
```

Szczegółowa instrukcja Supabase: [docs/SETUP_SUPABASE.md](./docs/SETUP_SUPABASE.md)

### 4. Uruchom migracje bazy danych

> **Od 2026-10-11 nowe migracje idą przez Supabase CLI i CI** — patrz
> [Migracje bazy](#migracje-bazy-supabase-cli). Poniższa lista to historia
> (001–016), potrzebna tylko przy stawianiu nowej bazy od zera.

W panelu Supabase → SQL Editor uruchom kolejno:

```
migration/001_create_budzety.sql
migration/002_rls_policies_phase2.sql
migration/003_authentication_phase3.sql
migration/004_category_embeddings.sql   ← pgvector + AI kategoryzacja
migration/005_email_password_auth.sql   ← Supabase Auth email+hasło
migration/006_fix_profiles_schema.sql   ← naprawa schematu profiles + trigger
migration/007_auto_create_household.sql ← auto-tworzenie household dla nowych userów
migration/008_fix_category_rules_rls.sql ← fix RLS: usunięcie permisywnej polityki (bezpieczeństwo)
migration/009_fix_match_rules_security.sql ← fix bezpieczeństwa funkcji dopasowującej reguły
migration/010_kategorie_rozszerzenie.sql ← rozszerzenie słownika kategorii
migration/011_kategoria_delegacje.sql   ← kategorie: delegacje + ubezpieczenie
migration/012_kategorie_zwierzeta_licencje.sql ← kategorie: zwierzęta + licencje
migration/013_budzety_unique_nulls_not_distinct.sql ← fix duplikatów budżetów (NULL-e w osoba/miesiac)
migration/014_dowody_i_zobowiazania.sql ← odciski importu, zobowiązania, aliasy kontrahentów
migration/015_profiles_household_lock.sql ← bezpieczeństwo: blokada zmiany household_id przez użytkownika
migration/016_revoke_public_execute.sql ← bezpieczeństwo: funkcje SECURITY DEFINER niedostępne dla anon
```

> Przed uruchomieniem migracji 004 włącz rozszerzenie **pgvector** w Supabase Dashboard → Database → Extensions.

> Migracja 013 wymaga **PostgreSQL 15+** (`UNIQUE NULLS NOT DISTINCT`) — sprawdź `show server_version;`.
> Kasuje też duplikaty budżetów, więc uruchom najpierw `migration/013_sprawdz_duplikaty.sql`
> (samo `SELECT`) i zapisz wynik poza repozytorium. Cofnięcie: `migration/rollback_013.sql`.

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
│   │   ├── LoginPage.jsx        # Strona logowania (email + hasło, reset hasła)
│   │   ├── TransactionForm.jsx  # Formularz transakcji
│   │   ├── TransactionItem.jsx  # Pojedyncza transakcja (swipe)
│   │   ├── YearlySummary.jsx    # Podsumowanie roczne z wykresami
│   │   ├── CSVImport.jsx        # Import CSV (drag-and-drop + AI)
│   │   ├── CategoryCharts.jsx   # Wykresy kategorii (Recharts)
│   │   ├── Budgets.jsx          # Zarządzanie budżetami
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
├── api/                         # Funkcje serverless (Vercel)
│   ├── _lib/                    # Wspólne moduły API (auth, walidacja, błędy)
│   ├── v1/[...route].js         # REST API CRUD (docs/API.md)
│   └── embeddings.js            # Proxy OpenAI Embeddings
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
| `OPENAI_API_KEY` | ➕ | Klucz OpenAI — **tylko po stronie serwera** (proxy `/api/embeddings`) |
| `VITE_AI_ENABLED` | ➕ | Flaga `true/false` włączająca kategoryzację AI w UI |
| `SUPABASE_URL` | ➕ | URL Supabase dla funkcji `/api/*` (domyślnie `VITE_SUPABASE_URL`) |
| `SUPABASE_ANON_KEY` | ➕ | Klucz anon dla funkcji `/api/*` (domyślnie `VITE_SUPABASE_ANON_KEY`) |

## Deployment

### Vercel (produkcja)

1. Połącz repozytorium z Vercel — build: `npm run build`, katalog `dist`, Node 22 (`.nvmrc`).
2. Ustaw zmienne środowiskowe (w tym `OPENAI_API_KEY` — bez prefiksu `VITE_`, by nie trafił do bundle'a).
3. Dodaj domenę do **Allowed URLs / Redirect URLs** w Supabase (Authentication → URL Configuration).
4. Migracje bazy wdraża CI po merge do `main` — patrz niżej.

`vercel.json` ustawia:
- **region funkcji `dub1`** (Dublin) — ten sam region co baza Supabase (`eu-west-1`);
  przy przeniesieniu bazy zmień region funkcji, inaczej każde żądanie `/api/*`
  płaci za podróż przez Atlantyk;
- **nagłówki bezpieczeństwa**: CSP (połączenia tylko do własnej domeny i
  `*.supabase.co`), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`. Nowa zewnętrzna usługa wołana z przeglądarki wymaga
  dopisania jej do `connect-src`;
- **cache**: `/assets/*` (pliki z hashem) na rok, `sw.js`/`index.html` bez
  cache — nowa wersja PWA dociera od razu.

### Środowiska preview

Deploye z PR-ów domyślnie dostają te same zmienne co produkcja, czyli łączą
się z **produkcyjną bazą z prawdziwymi finansami**. Zalecane:

1. Osobny projekt Supabase „budget-app-preview" z migracjami i danymi testowymi.
2. Vercel → Settings → Environment Variables: `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` w zakresie **Preview** wskazują na projekt preview.
3. Vercel → Settings → Deployment Protection: **Vercel Authentication** dla Preview.

### Checklista bezpieczeństwa Supabase

- Authentication → Email → **Confirm email = ON** (patrz `docs/SETUP_AUTH_PHASE3.md`).
- Authentication → **Allow new users to sign up = OFF**, jeśli z aplikacji
  korzysta tylko rodzina (nowe konta zakłada się wtedy w Dashboardzie).
  Zamyka to też koszt OpenAI dla obcych kont (`/api/embeddings`).
- Migracja `015` wdrożona: `SELECT column_name FROM information_schema.column_privileges
  WHERE table_name = 'profiles' AND grantee = 'authenticated' AND privilege_type = 'UPDATE';`
  zwraca tylko `display_name`, `updated_at`.

### CI

`.github/workflows/ci.yml` na każdym PR: lint, testy, build,
`sprawdz_przed_merge.sh`, `npm audit` (prod) i testy migracji SQL na
Postgresie 16. W ustawieniach repo warto włączyć **branch protection** dla
`main` z wymaganymi checkami CI.

### Migracje bazy (Supabase CLI)

Darmowa automatyzacja: job `migrations` w `ci.yml`.

| Zdarzenie | Co się dzieje |
|---|---|
| PR | testy SQL na Postgresie 16, potem `supabase db push --dry-run` — w logu lista migracji, które wejdą na produkcję |
| merge do `main` | po zielonych testach `supabase db push` na projekt produkcyjny |

**Nowa migracja:**

```bash
npx supabase@2.120.0 migration new nazwa_zmiany   # → supabase/migrations/<timestamp>_nazwa_zmiany.sql
```

- bez `BEGIN;`/`COMMIT;` — CLI wykonuje plik we własnej transakcji (CI to sprawdza);
- test: `supabase/tests/<timestamp>_nazwa_zmiany.test.sql` (asercje `DO $$ … ASSERT … $$`),
  opcjonalnie rollback: `supabase/rollbacks/<timestamp>_nazwa_zmiany.sql` — CI sprawdzi
  migracja → rollback → migracja (`migration/tests/run_sql_tests.sh`);
- **zgodność wstecz** (expand → contract): Vercel wdraża frontend równolegle z
  migracją, więc przez chwilę stary kod działa na nowej bazie i odwrotnie.
  Najpierw dodaj kolumnę/tabelę, w kolejnym PR usuń starą.
- nie zmieniaj schematu ręcznie w SQL Editorze — CLI o tym nie wie. Jeśli musisz:
  zapisz to samo jako plik migracji i oznacz go
  `npx supabase migration repair --status applied <timestamp>`.

**Jednorazowa konfiguracja (sekrety repo → Settings → Secrets and variables → Actions):**

| Sekret | Skąd |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens → *Generate new token* |
| `SUPABASE_DB_PASSWORD` | Project Settings → Database → hasło bazy (*Reset database password*, jeśli nieznane) |

Bez sekretów job kończy się ostrzeżeniem, a migracje trzeba wdrożyć ręcznie.

**Punkt startowy:** pliki `supabase/migrations/20261011*` z nagłówkiem `BASELINE`
odpowiadają migracjom 014–016 już wdrożonym na produkcji (są w
`supabase_migrations.schema_migrations`), więc `db push` je pomija. Starsze
migracje (001–013) nie są w historii CLI — lokalne `supabase start` nie
odtworzy pełnego schematu. Żeby to umożliwić, raz wykonaj
`npx supabase db dump -f supabase/migrations/20260101000000_baseline.sql`
(schemat produkcji) i `npx supabase migration repair --status applied 20260101000000`.

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
- [x] REST API `/api/v1` — pełny CRUD z autoryzacją JWT i izolacją gospodarstw
- [ ] Eksport danych do CSV (backup)
- [ ] Integracje bankowe (Open Banking API)
- [ ] Raporty szczegółowe PDF
- [ ] Wiele gospodarstw (multi-household)

## Licencja

MIT
