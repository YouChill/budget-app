-- 015_profiles_household_lock.sql
--
-- Problem: polityka "profiles_update_own" (003) pozwala zalogowanemu
-- użytkownikowi zmienić KAŻDĄ kolumnę własnego profilu, w tym household_id.
-- Wszystkie polityki RLS wyznaczają gospodarstwo z profiles.household_id,
-- więc wystarczyło:
--   supabase.from('profiles').update({ household_id: '<cudze-uuid>' }).eq('id', myId)
-- żeby dostać pełny odczyt i zapis danych innego gospodarstwa.
--
-- Naprawa (dwie warstwy):
--   1. Uprawnienia kolumnowe: rola API może zmieniać tylko display_name
--      i updated_at. Zmiana household_id → "permission denied".
--   2. Trigger blokujący zmianę household_id przez role API — na wypadek,
--      gdyby ktoś kiedyś przywrócił pełny GRANT UPDATE na tabeli.
--      Funkcje SECURITY DEFINER (trigger handle_new_user z 007) i service_role
--      działają jako właściciel, więc dalej mogą przypisywać gospodarstwo.
--
-- Idempotentna. Cofnięcie: migration/rollback_015.sql.

BEGIN;

-- ── 1. Uprawnienia kolumnowe ────────────────────────────────────────────────
-- Uprawnienie tabelowe nadpisuje kolumnowe, więc najpierw je odbieramy.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (display_name, updated_at) ON public.profiles TO authenticated;

-- ── 2. Trigger: household_id niezmienny dla ról API ────────────────────────
CREATE OR REPLACE FUNCTION public.profiles_lock_household()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.household_id IS DISTINCT FROM OLD.household_id
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Zmiana gospodarstwa (household_id) nie jest dozwolona'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_household ON public.profiles;
CREATE TRIGGER profiles_lock_household
  BEFORE UPDATE OF household_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_household();

COMMIT;

-- Weryfikacja (SQL Editor):
--   SELECT grantee, privilege_type, column_name
--   FROM information_schema.column_privileges
--   WHERE table_name = 'profiles' AND grantee = 'authenticated' AND privilege_type = 'UPDATE';
--   → tylko display_name, updated_at
