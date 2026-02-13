# Faza 3: Autentykacja — Setup Guide

## Przegląd

Faza 3 zabezpiecza aplikację poprzez Supabase Auth (Google OAuth) i Row Level Security (RLS). Użytkownicy będą się logować przez Google, a dane będą dostępne tylko dla członków ich gospodarstwa (household).

## Kroki Setup'u

### 1. Włączenie Google OAuth w Supabase Dashboard

1. Wejdź do [Supabase Dashboard](https://supabase.com/dashboard)
2. Wybierz projekt
3. **Authentication → Providers → Google**
4. Zmień status na **Enabled**
5. Skopiuj **Client ID** i **Client Secret** (zdobędziesz je w kroku 2)

### 2. Konfiguracja Google Cloud Console

1. Wejdź do [Google Cloud Console](https://console.cloud.google.com)
2. Utwórz nowy projekt lub wybierz istniejący
3. **API & Services → Credentials**
4. **Create Credentials → OAuth 2.0 Client ID**
5. Typ: **Web application**
6. **Authorized JavaScript origins** (dodaj):
   - `http://localhost:5173` (development)
   - `http://localhost:3000` (development alt)
7. **Authorized redirect URIs** (dodaj):
   - `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback` (production)
   - `http://localhost:5173/auth/v1/callback` (development)
8. Skopiuj wygenerowany **Client ID** i **Client Secret**

### 3. Wklejanie credentials do Supabase

W Supabase Dashboard → **Authentication → Providers → Google**:
- Wklej **Client ID** z Google Cloud
- Wklej **Client Secret** z Google Cloud
- Kliknij **Save**

### 4. Konfiguracja Redirect URLs w Supabase

**Authentication → URL Configuration:**
- **Site URL:** `https://YOUR_DOMAIN.vercel.app` (production) lub `http://localhost:5173` (dev)
- **Redirect URLs:** Dodaj obie:
  - `http://localhost:5173/` (development)
  - `https://YOUR_DOMAIN.vercel.app/` (production)

### 5. Zmienne środowiskowe (.env.local)

Zaktualizuj `.env.local` z:

```env
# Supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Optional: fallback dla development (używane tylko jeśli profil nie ma household_id)
VITE_HOUSEHOLD_ID=your_fallback_household_uuid
```

### 6. Zastosowanie migracji SQL (Phase 3)

Otwórz SQL Editor w Supabase Dashboard i uruchom plik:
`migration/003_authentication_phase3.sql`

Ta migracja:
- ✅ Tworzy tabelę `profiles` 
- ✅ Ustawia proper RLS polityki (zabezpiecza dane do household)
- ✅ Tworzy trigger auto-tworczący profil przy rejestracji
- ✅ Usuwa permissive polityki z fazy 2

### 7. Whitelisting użytkowników (opcjonalnie)

Jeśli chcesz zezwolić tylko określonym emailom:

1. **Authentication → User Management**
2. Ręcznie utwórz użytkowników lub
3. Zapraszaj użytkowników przez URL zaproszenia
4. W production — ustaw `Email Confirmations` na **ENABLED** aby kontrolować dostęp

## Workflow: Dodawanie nowego członka rodziny

### Scenariusz: Żona chce się zalogować

1. **Admin (inicjalny użytkownik) loguje się** do aplikacji
2. W Supabase Dashboard:
   - **Authentication → Users**
   - **Add User** → wpisz email żony
   - Wygeneruj hasło tymczasowe
3. **Żona loguje się za pomocą Google** (używając tego samego emaila)
4. **Profil żony automatycznie powstaje** (trigger `handle_new_user`)
5. **Admin przydzielą żonę do household:**
   ```sql
   UPDATE public.profiles
   SET household_id = 'uuid-household'
   WHERE email = 'zona@example.com';
   ```
6. **Żona będzie widzieć wszystkie dane** z tego household (RLS)

## Testowanie

### Test 1: Logowanie przez Google
- [ ] Klikam przycisk "Zaloguj się przez Google"
- [ ] Pojawia się popup Google
- [ ] Po zalogowaniu wracam do aplikacji
- [ ] Widzę swoje dane (transakcje, budżety, etc.)

### Test 2: Wylogowanie
- [ ] Klikam przycisk Wyloguj (w profilu)
- [ ] Sesja czyści się
- [ ] Powraca mnie na LoginPage

### Test 3: RLS — dostęp do obcych danych
- [ ] W Supabase SQL Editor, klonem to jako inny użytkownik:
  ```sql
  SELECT * FROM public.transakcje 
  WHERE household_id != auth.uid()::uuid;
  ```
- [ ] **Powinno zwrócić 0 wierszy** (RLS blokuje dostęp)

### Test 4: Multi-household
- [ ] Utwórz 2 households (Rodzina A, Rodzina B)
- [ ] Zaloguj 2 różnych użytkowników z różnych households
- [ ] Każdy widzi tylko swoje dane

## Troubleshooting

| Problem | Rozwiązanie |
|---------|-------------|
| "OAuth credentials error" | Sprawdź Client ID w `.env.local` |
| Profil nie tworzył się | Sprawdź trigger `handle_new_user` w SQL Editor |
| RLS: nie widać danych | Sprawdź czy `household_id` jest null w profilu |
| Google login pusty | Sprawdź redirect URL w Google Cloud Console |
| 403 Forbidden | Użytkownik nie należy do tego household (RLS) |

## Następne kroki (Phase 4)

- ✅ Phase 3: Autentykacja (DONE)
- 📋 Phase 4: Optymalizacja
  - Dodanie offline support z sync
  - Performance improvements
  - Error handling
  - Notification system

---

**Dokumentacja SQL:**
- [003_authentication_phase3.sql](../migration/003_authentication_phase3.sql) — migracja RLS i profiles
- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)

**Czytelna lista komponentów:**
- [src/contexts/AuthContext.jsx](../src/contexts/AuthContext.jsx) — zarządzanie stanem auth
- [src/components/LoginPage.jsx](../src/components/LoginPage.jsx) — ekran logowania
- [src/services/api.js](../src/services/api.js) — API z dynamic household_id
