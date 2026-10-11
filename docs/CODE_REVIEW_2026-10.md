# Code review — Budżet Domowy (październik 2026)

Stan bazowy: `main` @ `1b9052d` (merge PR #115).
Poprzedni audyt: `docs/AUDIT_2026-07.md` — jego poprawki (S1–S4, D1–D3) są
wdrożone i tutaj ich nie powtarzam.

Weryfikacja na starcie:

| Sprawdzenie | Wynik |
|---|---|
| `vitest run` | ✅ 356/356 (19 plików) |
| `vite build` | ✅, ale **jeden chunk JS 959 kB** (ostrzeżenie Vite > 500 kB) |
| `npx eslint .` | ❌ **nie działa** — `eslint.config.js` jest, ale `eslint` i pluginy nie są w `devDependencies` |
| `npm audit --omit=dev` | ✅ 0 podatności w zależnościach produkcyjnych |
| `npm audit` (z dev) | ⚠ nowe podatności w dev (`brace-expansion` high, `@vitest/mocker`, `baseline-browser-mapping` moderate) — `npm audit fix` |
| CI (`.github/workflows`) | ❌ brak |
| `vercel.json` / nagłówki bezpieczeństwa | ❌ brak |

---

## 1. Słabe strony — priorytetyzowane

### 🔴 K1. Użytkownik może sam zmienić sobie `household_id` (przejęcie cudzego gospodarstwa)

`migration/003_authentication_phase3.sql:25`

```sql
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

Polityka pozwala zalogowanemu użytkownikowi zaktualizować **każdą kolumnę**
własnego profilu, w tym `household_id`. Wszystkie polityki RLS (`transakcje`,
`kategorie`, `osoby`, `budzety`, `zobowiazania`, `transakcje_dowody`, …) opierają
się na `household_id IN (SELECT household_id FROM profiles WHERE id = auth.uid())`.

Scenariusz: rejestracja jest publiczna (`LoginPage` → `signUp`), więc każdy może
założyć konto, dostać JWT z kluczem anon z bundla i wykonać:

```js
supabase.from('profiles').update({ household_id: '<uuid-ofiary>' }).eq('id', myId)
```

— od tej chwili RLS daje mu pełny odczyt i zapis danych ofiary. Barierą jest
tylko znajomość UUID gospodarstwa, czyli dokładnie to samo „bezpieczeństwo przez
nieodgadywalność", które poprzedni audyt uznał za niewystarczające przy S1.
Dodatkowo eksportowana funkcja `assignUserToHousehold()` w
`src/services/api.js:44` zachęca do takiego użycia z poziomu klienta.

**Opcje naprawy** (od najprostszej):

- **A (zalecana, 3 linie SQL):** odebrać prawo do zmiany kolumny:
  ```sql
  REVOKE UPDATE ON public.profiles FROM authenticated, anon;
  GRANT UPDATE (display_name, updated_at) ON public.profiles TO authenticated;
  ```
  + usunąć `assignUserToHousehold` z `api.js` (nieużywana).
- **B:** trigger `BEFORE UPDATE` na `profiles`, który rzuca wyjątek, gdy
  `NEW.household_id IS DISTINCT FROM OLD.household_id` i `auth.role() <> 'service_role'`.
  Działa też, gdy ktoś kiedyś rozszerzy granty.
- **C (docelowo):** osobna tabela `household_members(household_id, user_id, role)`
  zarządzana wyłącznie przez funkcje `SECURITY DEFINER` (zaproszenia), a
  `profiles` bez `household_id`. Daje też obsługę wielu domowników z rolami.

Dodatkowo warto dodać test w `migration/tests/` (jest już harness `run_sql_tests.sh`),
który jako `authenticated` próbuje zmienić `household_id` i oczekuje błędu.

### 🟠 W1. Ciche obcinanie danych do 1000 wierszy (PostgREST `max_rows`)

`src/services/api.js:641` (`getTransakcjeForYear`), `getKontekstParowania`
(`api.js:288`), `getTransakcje`.

Supabase domyślnie zwraca maksymalnie **1000 wierszy** na zapytanie, bez błędu.
Zapytanie roczne nie ma paginacji, więc gospodarstwo z ~85+ transakcjami
miesięcznie (realne przy imporcie z kilku banków + Allegro rozbitego na pozycje)
dostanie **niepełny rok**: zaniżone sumy, YoY, oszczędności — i jeszcze
zapisane na 30 min w cache. Ten sam problem dotyczy okna parowania importu, co
może skutkować duplikatami (brak kandydata do sparowania).

**Opcje:**
- **A:** pętla `.range(from, from+999)` aż do krótszej strony (prosty helper
  `fetchAll(builder)`), użyta we wszystkich listach bez limitu.
- **B (lepsza wydajnościowo):** agregacje po stronie bazy — widok/RPC
  `podsumowanie_roku(rok)` zwracający sumy per miesiąc/kategoria/osoba. Widok
  „Rok" przestaje ściągać tysiące wierszy do przeglądarki.

### 🟠 W2. Kolejka offline przeżywa wylogowanie i trafia do następnego konta

`src/services/offlineQueue.js` trzyma operacje w `localStorage`
(`budget_offline_queue`), a `AuthContext.signOut` czyści tylko `sessionStorage`
(`AuthContext.jsx:137`). `processOfflineOperation` wyznacza `household_id` z
**aktualnie zalogowanego** użytkownika. Na współdzielonym urządzeniu transakcje
osoby A, dodane offline, zostaną po zalogowaniu osoby B zapisane do
gospodarstwa B.

**Opcje:** zapisywać `userId` przy każdej operacji i odrzucać/zatrzymywać
obce przy flushu (zalecane — nie traci danych), albo czyścić kolejkę przy
wylogowaniu z ostrzeżeniem „masz N niezsynchronizowanych operacji".

### 🟠 W3. Duplikaty przy ponawianiu operacji offline

`addTransakcja` z kolejki nie ma klucza idempotencji. Jeśli INSERT dojdzie do
bazy, a odpowiedź zginie (zerwane połączenie mobilne), operacja zostaje w
kolejce i przy kolejnej synchronizacji powstaje duplikat (do `MAX_ATTEMPTS=3`).
Masz już mechanizm dowodów (`transakcje_dowody`, `zrodlo` + `zrodlo_id`,
migracja 014) — wystarczy wysyłać operacje offline przez
`importuj_transakcje` z `zrodlo='offline'`, `zrodlo_id=operation.id`, albo dodać
kolumnę `client_id uuid unique` i robić `upsert`.

### 🟡 S1. Brak limitów kosztowych na `/api/embeddings` i `/api/v1`

Każde konto (rejestracja jest otwarta) może wołać `/api/embeddings` po 100
tekstów bez limitu częstotliwości → koszt OpenAI po stronie właściciela.
`/api/v1` przyjmuje batch 500 rekordów, też bez rate limitu.

**Opcje:** wyłączyć publiczną rejestrację w Supabase (Auth → *Allow new users
to sign up* = OFF), jeśli aplikacja jest tylko dla rodziny — najtańsze i
zamyka też część K1; albo rate limit per `user.id` (Upstash Redis / Vercel KV,
lub Vercel Firewall rate limiting rule na `/api/*`).

### 🟡 S2. Brak nagłówków bezpieczeństwa (CSP itd.)

Aplikacja z danymi finansowymi i tokenem sesji w `localStorage` (domyślne
zachowanie supabase-js) nie ustawia `Content-Security-Policy`,
`X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`,
`Strict-Transport-Security`, `Permissions-Policy`. React chroni przed większością
XSS, ale CSP to tania druga warstwa. Propozycja w sekcji 3 (`vercel.json`).

### 🟡 S3. Wielokrotne zapytania o profil na każdą operację

Każda funkcja w `api.js` woła `getHouseholdId()` → `supabase.auth.getUser()`
(**żądanie sieciowe do Auth**) + `select profiles`. `getAllData` robi to 3×
równolegle, czyli ~6 dodatkowych round-tripów przy każdym odświeżeniu miesiąca,
a każde zdarzenie realtime wywołuje pełne `fetchData`. Odnotowane w poprzednim
audycie, nadal nierozwiązane.

**Opcja:** memoizować `household_id` w module (`let cached; invalidate on
onAuthStateChange`) albo trzymać w `AuthContext`; `getSession()` zamiast
`getUser()` tam, gdzie wystarczy lokalny JWT (RLS i tak weryfikuje token).
Na serwerze (`api/_lib/auth.js`) można zweryfikować JWT lokalnie
(`supabase.auth.getClaims()` / JWKS) zamiast żądania do `/auth/v1/user`.

---

## 2. Jakość kodu i utrzymanie

| # | Problem | Propozycja |
|---|---|---|
| Q1 | `src/App.jsx` = 1768 linii (formularz, ustawienia, lista, realtime, routing widoków w jednym pliku); `components/CSVImport.jsx` = 1911 linii | Wydzielić `SettingsModal`, `TransactionList`, `MonthlyView`, hook `useRealtime`; w CSV — parsery bankowe (`lib/banki/millennium.js` itd.) jako czyste funkcje, komponent tylko UI. Ułatwi to też testy. |
| Q2 | Dwa katalogi komponentów: `/components` i `/src/components`, importy absolutne `'/components/...'` | Przenieść do `src/components`, dodać alias `@/` w `vite.config.js`. |
| Q3 | ESLint skonfigurowany, ale niezainstalowany — reguły `react-hooks` nie działają | `npm i -D eslint @eslint/js globals eslint-plugin-react-hooks eslint-plugin-react-refresh`, skrypt `"lint": "eslint ."`. Dla `api/` dodać `globals.node`. |
| Q4 | Bundle 959 kB w jednym chunku (recharts, papaparse, supabase) | `React.lazy` dla `YearlySummary`, `CSVImport`, `CategoryCharts`, `Budgets`; `manualChunks` dla `recharts`. Szybszy pierwszy start PWA na telefonie. |
| Q5 | Brak typów (czysty JS), a domena to pieniądze | Stopniowo: `// @ts-check` + JSDoc w `services/` i `lib/`, albo `supabase gen types typescript` i migracja `api.js` do TS. |
| Q6 | Kwoty liczone na `number` (float), zaokrąglane `roundTo2` | Wystarcza przy obecnej skali; przy dalszym rozwoju liczyć w groszach (integer) albo agregować w SQL (`numeric`). |
| Q7 | `keywords` w `package.json` zawiera `google-sheets`, `.gitignore` ma zduplikowane sekcje z instrukcją „DODAJ TO DO…" | Kosmetyka — posprzątać. |

---

## 3. Usprawnienia deploymentu

Dziś deployment to: Vercel buduje `main`, a migracje SQL **ręcznie** wkleja się
do SQL Editora (README, kroki 001–014 + rollbacki). Brak CI, więc testy i
`sprawdz_przed_merge.sh` zależą od pamięci osoby mergującej.

### D1. CI na GitHub Actions (najwyższy zwrot z inwestycji)

`.github/workflows/ci.yml` — na każdy PR i push do `main`:

```yaml
name: CI
on: [pull_request, push]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint          # po naprawie Q3
      - run: npx vitest run
      - run: npm run build
        env:
          VITE_SUPABASE_URL: https://example.supabase.co
          VITE_SUPABASE_ANON_KEY: ci-placeholder
      - run: bash sprawdz_przed_merge.sh   # wycieki wyciągów/sekretów
      - run: npm audit --omit=dev --audit-level=high
  sql:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: { POSTGRES_PASSWORD: postgres }, ports: ['5432:5432'] }
    steps:
      - uses: actions/checkout@v4
      - run: bash migration/tests/run_sql_tests.sh
```

Plus w ustawieniach repo: branch protection na `main` z wymaganym checkiem CI.
Dodatkowo Dependabot (`.github/dependabot.yml`, npm, co tydzień) — dev-podatności
pojawiły się ponownie od lipca.

### D2. `vercel.json` — nagłówki, cache i region

```json
{
  "regions": ["fra1"],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" }
    ]},
    { "source": "/assets/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ]},
    { "source": "/sw.js", "headers": [
      { "key": "Cache-Control", "value": "no-cache" } ]}
  ]
}
```

- `regions: fra1` — funkcje serverless blisko projektu Supabase w UE (sprawdź
  region bazy); dziś domyślny `iad1` dokłada ~100 ms na każde żądanie `/api/v1`
  w obie strony (funkcja ↔ baza).
- `sw.js` z `no-cache` — inaczej `registerType: 'autoUpdate'` może dostarczać
  nową wersję z opóźnieniem.
- CSP najpierw jako `Content-Security-Policy-Report-Only`, sprawdzić konsolę,
  potem przełączyć.

### D3. Migracje bazy — trzy opcje

| Opcja | Jak | Plusy / minusy |
|---|---|---|
| **A. Supabase CLI** (zalecana) | Przenieść `migration/0xx_*.sql` do `supabase/migrations/<timestamp>_*.sql`; `supabase db push` w workflow po merge do `main` (sekret `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`) | Historia zastosowanych migracji w bazie, `supabase db diff`, lokalny stack `supabase start` do testów. Wymaga jednorazowego `migration repair` dla już wdrożonych 001–014. |
| **B. Supabase Branching** | Integracja GitHub ↔ Supabase: każdy PR dostaje gałąź bazy z migracjami, Vercel Preview podpięty pod nią | Pełne środowiska preview z danymi testowymi; płatne (plan Pro). |
| **C. Minimalna** | Zostać przy ręcznym SQL Editorze, ale dodać tabelę `schema_migrations` + check w CI, że każdy nowy plik ma rollback i test w `migration/tests/` | Zero nowych narzędzi; nadal ręczny krok i ryzyko pominięcia. |

### D4. Środowiska i sekrety

- Osobny projekt Supabase dla **Preview** (Vercel → Environment Variables →
  scope *Preview*). Dziś preview deploye z PR-ów (jeśli włączone) gadają z
  produkcyjną bazą z prawdziwymi finansami.
- Włączyć **Vercel Deployment Protection** (Vercel Authentication) dla Preview.
- `api/_lib/auth.js` czyta `SUPABASE_URL || VITE_SUPABASE_URL` — ustawić jawnie
  `SUPABASE_URL`/`SUPABASE_ANON_KEY` dla funkcji i opisać to w `.env.example`.
- Przypiąć wersję Node: `"engines": { "node": ">=22 <23" }` + `.nvmrc`
  (Vercel i CI wtedy używają tej samej).

### D5. Obserwowalność

- Sentry (lub Vercel Observability) dla frontu i funkcji — `logger.error` jest
  już cienką warstwą, wystarczy podpiąć transport. Bez tego błędy importu CSV
  na telefonie są niewidoczne.
- Supabase: włączyć *Security/Performance Advisors* i regularnie sprawdzać
  (wykryłyby m.in. brakujące indeksy i polityki).
- Backup: na planie Free Supabase nie ma PITR — rozważyć cykliczny
  `pg_dump` przez GitHub Action (szyfrowany artefakt / zewnętrzny storage),
  skoro to jedyna kopia historii finansów.

---

## 4. Proponowana kolejność

1. **K1** — `REVOKE/GRANT` kolumnowy na `profiles` + test SQL (pół godziny, największe ryzyko).
2. Rozważyć wyłączenie publicznej rejestracji (S1) — jedna zmiana w Dashboardzie.
3. **W1** — paginacja `fetchAll` w zapytaniach rocznych/parowania.
4. **D1** CI + Q3 ESLint + Dependabot.
5. **W2/W3** — kolejka offline: `userId` + idempotencja przez `importuj_transakcje`.
6. **D2** `vercel.json` (nagłówki, region), **D4** osobna baza dla Preview.
7. **D3** migracje przez Supabase CLI.
8. Refaktor Q1/Q2/Q4 (podział `App.jsx`/`CSVImport.jsx`, lazy loading).
