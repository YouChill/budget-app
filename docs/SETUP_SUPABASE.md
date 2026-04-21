# 🔧 Konfiguracja Supabase

Przewodnik konfiguracji bazy danych Supabase dla aplikacji Budżet Domowy.

## 📋 Wymagania

- Konto Supabase (rejestracja na [supabase.com](https://supabase.com))
- Node.js 18+ (już zainstalowany)

## 🚀 Kroki instalacji

### 1. Utwórz projekt Supabase

1. Przejdź na [app.supabase.com](https://app.supabase.com)
2. Kliknij **New Project** (lub **Create a new project**)
3. Wybierz organizację (lub utwórz nową)
4. Podaj nazwę projektu, np. `budzet-domowy`
5. Ustaw hasło dla roli `postgres` (zapamiętaj je!)
6. Wybierz region (np. `Europe - Ireland` dla niskiej latencji w Polsce)
7. Kliknij **Create new project** i czekaj (~2 minuty na inicjalizację)

### 2. Skopiuj URL i klucz do `.env`

Po inicjalizacji projektu:

1. Przejdź do **Project Settings** → **API**
2. Skopiuj:
   - **Project URL** → wklej do `.env` jako `VITE_SUPABASE_URL`
   - **anon public key** (w sekcji **Project API keys**) → wklej do `.env` jako `VITE_SUPABASE_ANON_KEY`

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Wykonaj migracje bazy danych

Aplicacja zawiera migracje SQL w folderze `migration/`. Wykonaj je w następującej kolejności:

#### Opcja A: SQL Editor w Supabase Dashboard (najprościej)

1. Otwórz **SQL Editor** w panelu Supabase
2. Kliknij **New Query**
3. Skopiuj zawartość pliku `migration/001_create_budzety.sql`
4. Wklej do edytora i kliknij **Run** (Ctrl+Enter)
5. Powtórz dla `002_rls_policies_phase2.sql` i `003_authentication_phase3.sql`

#### Opcja B: Wiersz poleceń (za pomocą `psql`)

```bash
# Zainstaluj psql (PostgreSQL CLI) jeśli nie masz
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client
# Windows: https://www.postgresql.org/download/windows/

# Połącz z bazą (URL znajdziesz w Project Settings → Database)
psql -U postgres -h xxxxxxxxxxxxx.supabase.co -d postgres

# Wpisz hasło (które ustawiłeś przy tworzeniu projektu)

# Następnie w psql:
\i migration/001_create_budzety.sql
\i migration/002_rls_policies_phase2.sql
\i migration/003_authentication_phase3.sql

# Wyjdź
\q
```

### 4. Sprawdź tabele

Przejdź do **Table Editor** w Supabase — powinieneś zobaczyć tabele:
- `profiles`
- `households`
- `kategorie`
- `osoby`
- `transakcje`
- `budgets`

### 5. Utwórz gospodarstwo (household)

Gospodarstwo (household) to grupa osób współdzielących budżet. Utwórz jedno ręcznie:

1. Przejdź do **Table Editor** → **households**
2. Kliknij **Insert row**
3. Podaj:
   - **id**: Wygeneruj UUID (np. `f47ac10b-58cc-4372-a567-0e02b2c3d479`) lub pozwól Supabase to zrobić
   - **name**: "Moja rodzina" (lub inna nazwa)

4. Skopiuj **id** tego gospodarstwa
5. Wklej do `.env` jako `VITE_HOUSEHOLD_ID`:

```env
VITE_HOUSEHOLD_ID=f47ac10b-58cc-4372-a567-0e02b2c3d479
```

### 6. Skonfiguruj RLS (Row Level Security) — Supabase Auth

Migracja `003_authentication_phase3.sql` powinna już ustawić RLS policies. Jeśli chcesz zweryfikować:

1. Przejdź do **Authentication** → **Policies** (dla każdej tabeli)
2. Powinieneś zobaczyć polityki:
   - `SELECT`: użytkownik może czytać transakcje ze swojego gospodarstwa
   - `INSERT`: użytkownik może dodawać transakcje do swojego gospodarstwa
   - `UPDATE`/`DELETE`: użytkownik może edytować/usuwać własne transakcje

### 7. Przetestuj połączenie

Uruchom aplikację:

```bash
npm run dev
```

Przejdź do `http://localhost:5173` i zaloguj się kontem Google.

Aplikacja powinna:
1. Pobrać dane z Supabase
2. Pokazać puste listy kategorii/osób/transakcji (je jeśli to pierwszy start)
3. Pozwolić na dodanie transakcji

---

## 🔑 Zmienne środowiskowe

Po konfiguracji `.env` powinien wyglądać tak:

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_HOUSEHOLD_ID=f47ac10b-58cc-4372-a567-0e02b2c3d479
```

Logowanie działa przez Supabase Auth (email + hasło) — nie wymaga dodatkowych zmiennych w `.env`. Konfiguracja providera odbywa się w Supabase Dashboard (patrz `docs/SETUP_AUTH_PHASE3.md`).

---

## 🛡️ Bezpieczeństwo

### Public/Anon Key

Używamy **anon key** (public key) — to jest BEZPIECZNE, ponieważ:
- Supabase RLS (Row Level Security) chroni dane — użytkownik może czytać tylko swoje gospodar stwo
- JWT token zawiera `user_id`, który jest weryfikowany po stronie serwera
- Baza danych sama weryfikuje uprawnienia (SQL policy)

### Service Role Key

**Nigdy** nie wklejaj **service_role_key** do `.env.example` czy frontendu! Jest używany tylko do zadań admin (inicjalizacja, migracje).

### HTTPS Only

Zawsze używaj HTTPS w produkcji (Vercel/Netlify automatycznie)

---

## 🚢 Deployment

### Vercel / Netlify

1. Dodaj zmienne środowiskowe w ustawieniach projektu:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_HOUSEHOLD_ID`

2. W Supabase **Project Settings** → **API** → **Authorization** dodaj domenę hostingu do **Allowed origins**:
   ```
   https://moja-domena.vercel.app
   https://moja-domena.netlify.app
   ```

---

## 🔧 Troubleshooting

### "Brak połączenia z Supabase"

- Sprawdź czy `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` są poprawnie wklejone do `.env`
- Przeładuj stronę (Ctrl+R)
- Sprawdź konsolę przeglądarki (F12 → Console) czy są błędy CORS

### "Unauthorized" (401)

- Upewnij się że jesteś zalogowany (przycisk Login)
- Sprawdź czy Email provider jest włączony w Supabase (Authentication → Providers → Email)
- Sprawdź czy Supabase RLS policies pozwalają na akcję

### Migracje nie uruchomiły się

- Sprawdź czy wszytkie pliki SQL są w folderze `migration/`
- Uruchom je ręcznie przez SQL Editor
- Sprawdź czy nie ma błędów w SQL (sprawdź w konsoli)

---

## 📚 Zasoby

- [Dokumentacja Supabase](https://supabase.com/docs)
- [PostgreSQL dokumentacja](https://www.postgresql.org/docs/)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
