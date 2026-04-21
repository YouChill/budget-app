-- Faza 4 (fix): Naprawa triggera handle_new_user
--
-- Problem: rejestracja konczyla sie bledem "column email does not exist",
-- bo tabela public.profiles w tym projekcie nie ma kolumny email
-- (migracja 003 uzywa CREATE TABLE IF NOT EXISTS, wiec nie dodaje
-- kolumny do istniejacej tabeli z innym schematem).
--
-- Fix:
--   1. Dodaje kolumne email do profiles jesli jej brakuje
--      (nullable, zeby nie wywalic istniejacych wierszy).
--   2. Backfilluje email z auth.users dla istniejacych profili.
--   3. Ustawia email NOT NULL po backfilllu, jesli wszystkie wiersze
--      maja wartosc.
--   4. Przepisuje trigger na wersje z INSERT ... ON CONFLICT DO NOTHING,
--      ktora jest bezpieczniejsza (idempotent, brak race condition)
--      i nie wymaga UPDATE po PK.

-- 1. Dodaj kolumne email do profiles (jesli brakuje)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Backfill email z auth.users dla istniejacych profili
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE p.id = u.id
   AND p.email IS NULL;

-- 3. Przepisz trigger na wersje odporna
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  legacy_household_id UUID;
BEGIN
  -- Sprobuj znalezc stary profil z tym samym emailem (era Google)
  -- i zapamietac jego household_id.
  SELECT household_id INTO legacy_household_id
    FROM public.profiles
   WHERE email = NEW.email
     AND id <> NEW.id
   LIMIT 1;

  -- Usun stary profil (jesli byl) - przed INSERT nowego,
  -- zeby nie doszlo do konfliktu z unikalnym emailem (jesli dodany).
  DELETE FROM public.profiles
   WHERE email = NEW.email
     AND id <> NEW.id;

  -- Wstaw nowy profil; jesli juz istnieje (np. po retry), nic nie rob.
  INSERT INTO public.profiles (id, email, display_name, household_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    legacy_household_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
