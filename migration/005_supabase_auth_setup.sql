-- Migracja 005: Konfiguracja Supabase Auth
-- Zastępuje Google GIS auth natywnym Supabase Auth (email+hasło + OAuth Google)
--
-- Zmiany:
--   1. Trigger handle_new_user — przy rejestracji tworzy household + profil
--   2. Polityka RLS — pozwala użytkownikowi wstawić własny profil (OAuth flow)
--   3. Polityka RLS — pozwala użytkownikowi aktualizować swój household_id
--      (potrzebne gdy admin przypisuje usera do istniejącego household)
--
-- WAŻNE: Uruchom tę migrację JEDNORAZOWO w Supabase SQL Editor.
-- Możesz uruchomić ją wielokrotnie — wszystkie operacje są idempotentne.

-- ═══════════════════════════════════════════
-- 1. AKTUALIZACJA TRIGGERA handle_new_user
-- ═══════════════════════════════════════════
-- Problem w migracji 003: trigger tworzył profil bez household_id,
-- więc nowy użytkownik nie miał dostępu do żadnych danych (RLS blokował wszystko).
--
-- Nowe zachowanie: przy rejestracji nowego usera automatycznie tworzony jest
-- dedykowany household o nazwie równej emailowi usera.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id UUID;
BEGIN
  -- Utwórz nowy household dla użytkownika
  INSERT INTO public.households (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'name', NEW.email))
  RETURNING id INTO v_household_id;

  -- Utwórz profil z przypisanym household
  INSERT INTO public.profiles (id, email, display_name, household_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    v_household_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger już istnieje z migracji 003 — zastępujemy tylko funkcję (DROP + CREATE powyżej)
-- Jeśli trigger z jakiegoś powodu nie istnieje, utwórz go:
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════
-- 2. POLITYKI RLS DLA PROFILI — KOREKTY
-- ═══════════════════════════════════════════

-- Usuń stare polityki (jeśli istnieją) przed ich odtworzeniem
DROP POLICY IF EXISTS "profiles_insert_own"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;

-- Zezwól użytkownikowi wstawić własny profil (potrzebne przy OAuth, gdy trigger
-- może jeszcze nie zadziałać przy pierwszym żądaniu z nowym tokenem)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ═══════════════════════════════════════════
-- 3. POLITYKA: AKTUALIZACJA household_id
-- ═══════════════════════════════════════════
-- Dodaj politykę umożliwiającą adminowi lub samemu userowi
-- przypisanie household_id (np. dołączenie do rodziny).
-- Obecna polityka update_own z migracji 003 to już obsługuje,
-- ale upewniamy się że household_id jest w zakresie aktualizowalnych pól.

-- Polityka update_own z migracji 003 jest wystarczająca — nie trzeba dodawać nowej.

-- ═══════════════════════════════════════════
-- 4. HOUSEHOLDS — POLITYKA INSERT DLA UŻYTKOWNIKÓW
-- ═══════════════════════════════════════════
-- Trigger tworzy household w SECURITY DEFINER, więc działa jako service_role.
-- Nie trzeba otwierać polityki INSERT dla normalnych użytkowników.
-- Zostawiamy istniejące polityki z migracji 003.

-- ═══════════════════════════════════════════
-- WERYFIKACJA
-- ═══════════════════════════════════════════
-- Po uruchomieniu tej migracji przetestuj:
--
-- 1. Zarejestruj nowe konto email/hasło w aplikacji
-- 2. Sprawdź w Supabase Dashboard:
--    - auth.users    → powinien pojawić się nowy rekord
--    - public.profiles   → powinien pojawić się profil z household_id
--    - public.households → powinien pojawić się nowy household
-- 3. Zaloguj się — aplikacja powinna wczytać dane (lub pustą listę dla nowego usera)
--
-- Logowanie Google OAuth wymaga skonfigurowania w Supabase Dashboard:
--   Authentication → Providers → Google → włącz, wstaw Client ID + Secret
--   Authentication → URL Configuration → dodaj Redirect URL aplikacji
