-- Faza 4 (fix 2): Auto-tworzenie household dla nowych uzytkownikow
--
-- Problem: po rejestracji/logowaniu uzytkownik nie widzial zadnych
-- transakcji, bo trigger handle_new_user tworzyl profil z
-- household_id = NULL (chyba ze istnial stary profil z tym samym
-- emailem). Wszystkie zapytania (transakcje, kategorie, osoby,
-- budzety) filtruja po household_id, wiec NULL = pustka.
--
-- Fix:
--   1. Backfill: dla kazdego istniejacego profilu bez household_id
--      tworzymy nowe gospodarstwo i przypisujemy go.
--   2. Trigger handle_new_user: jesli nie znaleziono legacy
--      household_id po emailu, tworzymy nowe gospodarstwo dla
--      nowego uzytkownika.

-- 1. Backfill istniejacych profili z NULL household_id
DO $$
DECLARE
  profile_row RECORD;
  new_household_id UUID;
BEGIN
  FOR profile_row IN
    SELECT id, email, display_name FROM public.profiles WHERE household_id IS NULL
  LOOP
    INSERT INTO public.households (name)
    VALUES (COALESCE(profile_row.display_name, split_part(profile_row.email, '@', 1), 'Moje gospodarstwo'))
    RETURNING id INTO new_household_id;

    UPDATE public.profiles
       SET household_id = new_household_id
     WHERE id = profile_row.id;
  END LOOP;
END $$;

-- 2. Przepisz trigger: tworzy household dla nowych signupow,
--    jesli nie ma legacy profilu z tym samym emailem.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  legacy_household_id UUID;
  resolved_household_id UUID;
  resolved_display_name TEXT;
BEGIN
  resolved_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

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

  IF legacy_household_id IS NOT NULL THEN
    resolved_household_id := legacy_household_id;
  ELSE
    -- Nowy uzytkownik bez legacy - utworz dla niego gospodarstwo.
    INSERT INTO public.households (name)
    VALUES (resolved_display_name)
    RETURNING id INTO resolved_household_id;
  END IF;

  -- Wstaw nowy profil; jesli juz istnieje (np. po retry), nic nie rob.
  INSERT INTO public.profiles (id, email, display_name, household_id)
  VALUES (
    NEW.id,
    NEW.email,
    resolved_display_name,
    resolved_household_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
