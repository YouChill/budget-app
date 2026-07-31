# REST API — `/api/v1`

Pełne API CRUD dla danych gospodarstwa domowego (transakcje, kategorie, osoby, budżety), zrealizowane jako funkcja serverless (Vercel) w `api/v1/[...route].js`.

## Model bezpieczeństwa

Bezpieczeństwo danych i rozdzielność informacji rodzin (gospodarstw) opierają się na **dwóch niezależnych warstwach**:

1. **RLS (Row Level Security)** — API wykonuje wszystkie zapytania klientem Supabase skonfigurowanym z **tokenem JWT użytkownika** i kluczem `anon` (nigdy `service_role`). Polityki RLS z migracji `003`/`008` ograniczają każdą operację do gospodarstwa użytkownika — nawet błąd w kodzie API nie ujawni cudzych danych.
2. **Jawne filtrowanie po `household_id`** — identyfikator gospodarstwa jest wyznaczany **wyłącznie po stronie serwera** z profilu zalogowanego użytkownika (`profiles.household_id`) i dodawany do każdego zapytania. Wartości `household_id`/`id` przysłane w body są ignorowane (biała lista pól — ochrona przed mass assignment).

Dodatkowo:

- **Uwierzytelnienie przed routingiem** — każde żądanie (także do nieznanych ścieżek) wymaga ważnego JWT; żaden endpoint nie jest publiczny.
- **Brak wycieku informacji** — rekord nieistniejący i rekord z cudzego gospodarstwa zwracają identyczne `404`.
- **Walidacja wejścia** — format daty, dozwolone wartości `typ`/`zakres`, limity długości tekstów i wielkości kwot, limit batcha (500 rekordów), limit paginacji (500 wierszy).
- **Bezpieczne błędy** — odpowiedzi nie zawierają szczegółów SQL/stacktrace (pełne błędy trafiają tylko do logów serwera).
- **`Cache-Control: no-store`** — odpowiedzi z danymi finansowymi nie są cache'owane po drodze.
- **Brak nagłówków CORS** — API domyślnie dostępne tylko same-origin (z domeny aplikacji).

## Uwierzytelnienie

Każde żądanie wymaga nagłówka z tokenem sesji Supabase:

```
Authorization: Bearer <supabase access token>
```

Token uzyskasz w aplikacji z `supabase.auth.getSession()` (pole `access_token`). Odpowiedzi błędów:

| Kod | Znaczenie |
|-----|-----------|
| 401 | Brak / nieważny / wygasły token |
| 403 | Profil bez przypisanego gospodarstwa lub odmowa RLS |

## Format odpowiedzi

- Lista: `{ "items": [...], "total": <liczba wszystkich>, "limit": n, "offset": n }`
- Pojedynczy rekord: obiekt JSON
- Utworzenie: `201` + rekord (batch: `{ "items": [...], "count": n }`)
- Usunięcie: `204` bez body
- Błąd: `{ "error": "komunikat", "details": ["..."] }` (`details` tylko przy błędach walidacji)

## Endpointy

### `GET /api/v1/me`

Zwraca kontekst zalogowanego użytkownika:

```json
{
  "user": { "id": "…", "email": "…" },
  "profile": { "display_name": "…" },
  "household": { "id": "…", "name": "…" }
}
```

### Transakcje — `/api/v1/transakcje`

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/transakcje` | Lista z filtrami i paginacją |
| POST | `/transakcje` | Utworzenie — obiekt lub tablica (≤ 500) |
| GET | `/transakcje/:id` | Pojedyncza transakcja |
| PUT | `/transakcje/:id` | Pełna aktualizacja |
| PATCH | `/transakcje/:id` | Częściowa aktualizacja |
| DELETE | `/transakcje/:id` | Usunięcie |

Parametry listy: `rok` (1970–2100), `miesiac` (1–12, wymaga `rok`), `od`/`do` (`YYYY-MM-DD`), `typ` (`Wydatek`/`Przychód`), `kategoria`, `osoba`, `limit` (domyślnie 100, maks. 500), `offset`.

Pola zapisu: `data`* (`YYYY-MM-DD`), `typ`* (`Wydatek`/`Przychód`), `kwota`* (liczba ≠ 0 — zapisywana jako wartość bezwzględna, znak wynika z `typ`), `kategoria`*, `podkategoria`, `osoba`, `komentarz`. (* — wymagane przy POST/PUT)

Przykład:

```bash
curl -X POST https://twoja-domena/api/v1/transakcje \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":"2026-07-31","typ":"Wydatek","kwota":54.30,"kategoria":"Jedzenie","podkategoria":"Zakupy spożywcze","osoba":"Paweł"}'
```

### Kategorie — `/api/v1/kategorie`

Te same metody CRUD co wyżej. Parametry listy: `typ`. Pola zapisu: `typ`* (`Wydatek`/`Przychód`), `kategoria`*, `podkategoria`.

### Osoby — `/api/v1/osoby`

Te same metody CRUD. Pola zapisu: `nazwa`*.

### Budżety — `/api/v1/budzety`

Te same metody CRUD. Parametry listy: `rok`, `miesiac`, `zakres` (`monthly`/`yearly`), `kategoria`.

Pola zapisu: `kategoria`*, `limit_kwota`* (≥ 0), `zakres`* (`monthly`/`yearly`), `rok`* (1970–2100), `miesiac` (1–12; **wymagany** przy `zakres=monthly`, wymuszany na `null` przy `yearly`), `osoba`, `notatki`.

Duplikat kombinacji `(kategoria, osoba, zakres, rok, miesiac)` zwraca `409` (unikalny indeks w bazie).

## Kody odpowiedzi

| Kod | Znaczenie |
|-----|-----------|
| 200 | OK |
| 201 | Utworzono |
| 204 | Usunięto (bez body) |
| 400 | Błąd walidacji (szczegóły w `details`) |
| 401 | Brak / nieważny token |
| 403 | Brak gospodarstwa / odmowa RLS |
| 404 | Zasób nie istnieje lub należy do innego gospodarstwa |
| 405 | Niedozwolona metoda (nagłówek `Allow` wskazuje dozwolone) |
| 409 | Konflikt unikalności |
| 413 | Zbyt duży batch (> 500 rekordów) |
| 503 | Brak konfiguracji środowiska (`SUPABASE_URL` / `SUPABASE_ANON_KEY`) |

## Uruchomienie lokalne

Funkcje w katalogu `api/` (podobnie jak istniejący `/api/embeddings`) działają na Vercelu — lokalnie uruchomisz je przez:

```bash
npx vercel dev
```

Zwykłe `npm run dev` (Vite) serwuje tylko frontend — endpointy `/api/*` wymagają środowiska Vercel. Wymagane zmienne środowiskowe: `SUPABASE_URL` (lub `VITE_SUPABASE_URL`) i `SUPABASE_ANON_KEY` (lub `VITE_SUPABASE_ANON_KEY`). Klucz `service_role` **nie jest** używany i nie należy go dodawać do środowiska funkcji.

## Struktura kodu

```
api/
├── _lib/                  # moduły współdzielone (nie są endpointami)
│   ├── auth.js            # JWT → klient Supabase użytkownika + household_id z profilu
│   ├── errors.js          # ApiError, mapowanie błędów Postgres → HTTP
│   └── validate.js        # walidatory payloadów (biała lista pól)
├── v1/
│   └── [...route].js      # router REST: transakcje, kategorie, osoby, budzety, me
├── __tests__/
│   └── api-v1.test.js     # testy: autoryzacja, izolacja household, walidacja, CRUD
└── embeddings.js          # istniejący proxy OpenAI (bez zmian)
```
