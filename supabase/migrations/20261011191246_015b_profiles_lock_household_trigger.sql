-- BASELINE: zastosowana na produkcji przed wprowadzeniem Supabase CLI (2026-10-11,
-- przez Supabase MCP). Wpis istnieje w supabase_migrations.schema_migrations, więc
-- `supabase db push` ją pomija. Źródło i testy: migration/
-- Odpowiada migration/015_profiles_household_lock.sql, część 2.

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

CREATE TRIGGER profiles_lock_household
  BEFORE UPDATE OF household_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_household();
