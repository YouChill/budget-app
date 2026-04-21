-- Faza 4: Migracja z Google OAuth na email+hasło (Supabase Auth native)
--
-- Zmiany w stosunku do 003_authentication_phase3.sql:
--   - handle_new_user() rozpoznaje istniejacy profil po emailu
--     (era Google) i przepina go na nowy auth.users.id,
--     zachowujac household_id (a wiec cala historie transakcji).
--   - Jesli email jest nowy -> tworzy sie pusty profil bez household_id.
--
-- RLS policies z migracji 003 pozostaja bez zmian - wciaz opieraja sie
-- na auth.uid() i profiles.household_id.
--
-- UWAGA BEZPIECZENSTWO: Aby nikt obcy nie przejal cudzego household_id
-- wpisujac cudzy email, w Supabase Dashboard musi byc wlaczone:
--   Authentication -> Email -> "Confirm email" = ON

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
     SET id = NEW.id
   WHERE email = NEW.email;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
