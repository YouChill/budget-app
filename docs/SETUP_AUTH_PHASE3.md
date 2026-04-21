# Autentykacja — Setup Guide

## Przegląd

Aplikacja używa **Supabase Auth** z logowaniem przez **email + hasło**. Row Level Security (RLS) ogranicza dostęp do danych wyłącznie do członków tego samego gospodarstwa (`household`).

> Historyczna uwaga: wcześniejsza wersja (Phase 3) używała Google OAuth przez Google Identity Services. Migracja na Supabase Auth została wykonana w `migration/005_email_password_auth.sql`.

## Kroki Setupu

### 1. Włączenie Email provider w Supabase Dashboard

1. Wejdź do [Supabase Dashboard](https://supabase.com/dashboard) → wybierz projekt.
2. **Authentication → Providers → Email**:
   - **Enable email signup:** ON
   - **Confirm email:** ON (wymagane — patrz sekcja bezpieczeństwo)
3. **Authentication → Providers → Google:** OFF (nie używamy).

### 2. Konfiguracja URL Configuration

**Authentication → URL Configuration:**
- **Site URL:** `http://localhost:5173` (dev) lub `https://YOUR_DOMAIN.vercel.app` (prod).
- **Redirect URLs:** dodaj oba warianty z i bez końcowego slasha.

### 3. Szablony email (opcjonalnie, po polsku)

**Authentication → Email Templates** — przetłumacz:
- **Confirm signup** — link potwierdzający rejestrację.
- **Reset password** — link do resetu hasła.

### 4. Zmienne środowiskowe (.env.local)

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Fallback dla dev (używany tylko jeśli profil nie ma household_id)
VITE_HOUSEHOLD_ID=your_fallback_household_uuid
```

### 5. Migracje SQL

Uruchom w Supabase SQL Editor w kolejności:

```
migration/001_create_budzety.sql
migration/002_rls_policies_phase2.sql
migration/003_authentication_phase3.sql
migration/004_category_embeddings.sql
migration/005_email_password_auth.sql   ← email+hasło + zachowanie household_id po emailu
```

Migracja 005 podmienia trigger `handle_new_user` tak, żeby przy rejestracji nową metodą zachować `household_id` istniejącego profilu o tym samym emailu (z ery Google).

### 6. Dodawanie członka gospodarstwa

1. Admin w Supabase Dashboard → **Authentication → Users → Add User**, wpisuje email żony i tymczasowe hasło (albo wysyła invite).
2. Żona loguje się przez formularz w aplikacji (lub klika invite link i ustawia hasło).
3. Trigger `handle_new_user` tworzy pusty profil.
4. Admin przypisuje żonę do household:
   ```sql
   UPDATE public.profiles
      SET household_id = 'uuid-household'
    WHERE email = 'zona@example.com';
   ```
5. Żona widzi wszystkie dane household (RLS).

## Bezpieczeństwo — dlaczego "Confirm email = ON"

Trigger `handle_new_user` w migracji 005 identyfikuje "stary" profil po emailu i przepina do niego nowy `auth.users.id`, żeby zachować `household_id`. Bez potwierdzenia emaila ktoś obcy mógłby zarejestrować się z cudzym adresem i przejąć cudze finanse. **Confirm email = ON** gwarantuje, że konto powstaje dopiero gdy właściciel adresu kliknie w link potwierdzający.

## Testowanie

### Test 1: Rejestracja
- [ ] Na ekranie logowania klikam "Nie masz konta? Zarejestruj się"
- [ ] Wypełniam email, hasło (≥ 8 znaków), potwierdzenie
- [ ] Pojawia się komunikat "Sprawdź skrzynkę email…"
- [ ] Klikam link w emailu → wracam do aplikacji jako zalogowany

### Test 2: Logowanie
- [ ] Wpisuję email + hasło
- [ ] Zostaję zalogowany, widzę swoje dane

### Test 3: Reset hasła
- [ ] Klikam "Zapomniałeś hasła?"
- [ ] Wpisuję email
- [ ] Pojawia się komunikat informacyjny
- [ ] Klikam link w emailu, ustawiam nowe hasło

### Test 4: RLS — dostęp do obcych danych
- [ ] Po zalogowaniu wykonaj w SQL Editor (jako ten user):
  ```sql
  SELECT COUNT(*) FROM public.transakcje
   WHERE household_id NOT IN (
     SELECT household_id FROM public.profiles WHERE id = auth.uid()
   );
  ```
- [ ] Powinno zwrócić **0** (RLS blokuje dostęp do cudzych household).

## Troubleshooting

| Problem | Rozwiązanie |
|---------|-------------|
| "Invalid login credentials" | Zły email/hasło albo email nie został potwierdzony |
| "Email not confirmed" | Klient nie kliknął linku z emaila — sprawdź skrzynkę, spam |
| Profil nie utworzony | Sprawdź trigger `handle_new_user` (migracja 005) |
| Brak widocznych danych | Sprawdź `profiles.household_id` — może być NULL (admin musi przypisać) |
| 403 Forbidden | Użytkownik nie należy do tego household (RLS) |

---

**Powiązane pliki:**
- [migration/003_authentication_phase3.sql](../migration/003_authentication_phase3.sql) — RLS + profiles (bez zmian)
- [migration/005_email_password_auth.sql](../migration/005_email_password_auth.sql) — migracja triggera
- [src/contexts/AuthContext.jsx](../src/contexts/AuthContext.jsx) — stan auth, signIn/signUp/resetPassword
- [src/components/LoginPage.jsx](../src/components/LoginPage.jsx) — formularz logowania
- [src/services/api.js](../src/services/api.js) — API ze wspieraniem RLS
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
