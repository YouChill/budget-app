# Budżet Domowy

Aplikacja do śledzenia domowych wydatków i przychodów. Stworzona z myślą o wspólnym zarządzaniu finansami przez pary/rodziny.

![React](https://img.shields.io/badge/React-19-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC)
![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E)

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
- **Import CSV** — import wyciągów bankowych z automatycznym dopasowaniem kategorii
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
- **Real-time:** Supabase Realtime (WebSocket)
- **Hosting:** Netlify / Vercel (opcjonalnie)

## Wymagania

- Node.js 18+
- Konto Supabase (baza danych PostgreSQL)
- Konto Google (do autoryzacji OAuth logowania)

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

Uzupełnij plik `.env` z danymi Supabase i Google OAuth:

```env
VITE_SUPABASE_URL=https://twoj-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=twoj-anon-key
VITE_HOUSEHOLD_ID=twoj-household-uuid
VITE_GOOGLE_CLIENT_ID=TWOJ_CLIENT_ID.apps.googleusercontent.com
```

Szczegółowa instrukcja: [SETUP_SUPABASE.md](./docs/SETUP_SUPABASE.md)

### 4. Skonfiguruj autoryzację Google OAuth

Szczegółowa instrukcja: [SETUP_AUTH_PHASE3.md](./docs/SETUP_AUTH_PHASE3.md)

Krótko:
1. Utwórz projekt w Google Cloud Console
2. Skonfiguruj OAuth 2.0 Client ID
3. Wklej Client ID do `.env` jako `VITE_GOOGLE_CLIENT_ID`

### 5. Uruchom lokalnie

```bash
npm run dev
```

Aplikacja będzie dostępna pod adresem: `http://localhost:5173`

## Struktura projektu

```
budget-app/
├── src/
│   ├── App.jsx                  # Główna aplikacja React
│   ├── main.jsx                 # Punkt wejścia
│   ├── index.css                # Style Tailwind
│   ├── components/
│   │   ├── LoginPage.jsx        # Strona logowania Google OAuth
│   │   ├── TransactionForm.jsx  # Formularz transakcji
│   │   ├── TransactionItem.jsx  # Pojedyncza transakcja (swipe)
│   │   ├── YearlySummary.jsx    # Podsumowanie roczne z wykresami
│   │   └── OfflineBanner.jsx    # Banner trybu offline
│   ├── contexts/
│   │   ├── AuthContext.jsx      # Kontekst autoryzacji (JWT)
│   │   └── ToastContext.jsx     # Kontekst powiadomień
│   ├── hooks/
│   │   └── useOffline.js        # Hook do offline mode
│   ├── lib/
│   │   └── supabase.js          # Klient Supabase
│   ├── services/
│   │   ├── api.js               # API do Supabase
│   │   └── offlineQueue.js      # Kolejka offline operations
│   ├── utils/
│   │   └── calculations.js      # Obliczenia finansowe (agregacje, YoY)
│   └── __tests__/               # Testy jednostkowe i integracyjne
├── components/
│   ├── CategoryCharts.jsx       # Wykresy kategorii (Recharts)
│   ├── CSVImport.jsx            # Import CSV z banku
│   └── Budgets.jsx              # Zarządzanie budżetami
├── migration/
│   ├── migrate.mjs              # Skrypt jednorazowej migracji z CSV
│   ├── *.sql                    # Migracje bazy danych (DDL, RLS)
│   └── csv/                     # Przykładowe dane CSV
├── docs/
│   ├── SETUP_SUPABASE.md        # Instrukcja konfiguracji Supabase
│   ├── SETUP_AUTH_PHASE3.md     # Instrukcja konfiguracji OAuth
│   └── CSV_IMPORT.md            # Dokumentacja importu CSV
├── public/                      # Zasoby statyczne (favicony, manifest)
├── index.html
├── package.json
├── vite.config.js
├── postcss.config.js
├── eslint.config.js
└── .env.example                 # Szablon zmiennych środowiskowych
```

## Struktura danych w Supabase

Aplikacja korzysta z poniższych tabel w PostgreSQL:

### transakcje
| Pole | Typ | Opis |
|------|-----|------|
| id | UUID | Klucz główny |
| household_id | UUID | Gospodarstwo |
| data | DATE | Data transakcji |
| typ | TEXT | 'Wydatek' lub 'Przychód' |
| kwota | NUMERIC | Kwota w PLN |
| kategoria | TEXT | Kategoria wydatku |
| podkategoria | TEXT | Podkategoria |
| osoba | TEXT | Osoba wpisująca |
| komentarz | TEXT | Notatka |
| created_at | TIMESTAMP | Data utworzenia |

### kategorie
| Pole | Typ |
|------|-----|
| id | UUID |
| household_id | UUID |
| typ | TEXT |
| nazwa | TEXT |
| podkategorie | JSONB |

### osoby
| Pole | Typ |
|------|-----|
| id | UUID |
| household_id | UUID |
| nazwa | TEXT |

### budgets
| Pole | Typ |
|------|-----|
| id | UUID |
| household_id | UUID |
| month | INTEGER |
| year | INTEGER |
| kategoria | TEXT |
| limit | NUMERIC |

## Konfiguracja

### Zmienne środowiskowe

Konfiguracja odbywa się poprzez plik `.env` (skopiuj z `.env.example`):

| Zmienna | Opis |
|---------|------|
| `VITE_SUPABASE_URL` | URL projektu Supabase |
| `VITE_SUPABASE_ANON_KEY` | Klucz anonimowy (public) Supabase |
| `VITE_HOUSEHOLD_ID` | UUID gospodarstwa domowego |
| `VITE_GOOGLE_CLIENT_ID` | Client ID z Google Cloud Console (OAuth 2.0) |

### Domyślne kategorie

Kategorie są przechowywane w bazie Supabase i mogą być edytowane bezpośrednio w aplikacji w sekcji Ustawienia. Aplikacja zawiera 40+ predefiniowanych kategorii (Mieszkanie, Transport, Jedzenie, Zdrowie, Rozrywka, Odzież, Dom, Dzieci, Kredyty i inne).

## Deployment

### Netlify

1. Zbuduj aplikację:
```bash
npm run build
```
2. Połącz repozytorium GitHub z [netlify.com](https://netlify.com)
3. Netlify automatycznie wykryje Vite i skonfiguruje build
4. Ustaw zmienne środowiskowe w ustawieniach projektu: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_HOUSEHOLD_ID`, `VITE_GOOGLE_CLIENT_ID`

### Vercel

1. Połącz repozytorium GitHub z [vercel.com](https://vercel.com)
2. Vercel automatycznie wykryje Vite i skonfiguruje build
3. Ustaw zmienne środowiskowe w ustawieniach projektu

**Ważne:** Dodaj domenę hostingu do **Authorized JavaScript origins** w ustawieniach OAuth w Google Cloud Console oraz do **Authorized URLs** w ustawieniach Supabase.

## Roadmap

- [x] MVP — dodawanie/usuwanie/edycja transakcji
- [x] Podsumowanie miesiąca
- [x] Autoryzacja Google OAuth 2.0
- [x] Migracja na Supabase (PostgreSQL)
- [x] Wykresy kategorii (kołowe i słupkowe)
- [x] Import CSV z banku
- [x] Budżetowanie (plan vs realizacja)
- [x] Offline mode z offline queue
- [x] Zarządzanie słownikami w aplikacji
- [x] Real-time subscriptions
- [x] Podsumowanie roczne z porównaniem lat i podziałem na osoby
- [ ] Eksport danych do CSV (backup)
- [ ] Integracje bankowe (API banków)
- [ ] Raporty szczegółowe
- [ ] Wiele gospodarstw (multi-household)

## Współtworzenie

Pull requesty są mile widziane! Przy większych zmianach proszę najpierw otworzyć issue.

## Licencja

MIT
