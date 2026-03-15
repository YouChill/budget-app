-- Faza 6: Automatyczne przypisanie istniejących użytkowników do rodziny
--
-- Problem: po migracji na Supabase Auth OAuth, każdy logujący się pierwszy raz
-- dostaje profil z household_id = NULL i widzi ekran konfiguracji rodziny.
-- Jeśli w bazie istnieje już jedno gospodarstwo (z wcześniejszego importu danych),
-- chcemy, żeby wszyscy znani użytkownicy byli do niego automatycznie przypisani.
--
-- Co robi ta migracja:
-- 1. Aktualizuje trigger handle_new_user() — nowo zalogowani użytkownicy są
--    automatycznie przypisywani do istniejącego household (jeśli istnieje dokładnie jeden).
--    Pierwszy użytkownik dostaje rolę 'owner', pozostali 'member'.
-- 2. Naprawia już istniejące profile bez household_id (np. stworzone przez stary trigger).
-- 3. Ustawia kod zaproszenia dla istniejącego household (jeśli nie ma).

-- ═══════════════════════════════════════════
-- KROK 1: Zaktualizuj trigger handle_new_user()
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id UUID;
  v_role TEXT;
BEGIN
  -- Pobierz istniejący household (zakładamy jeden główny — rodzinny)
  SELECT id INTO v_household_id
  FROM public.households
  ORDER BY created_at ASC
  LIMIT 1;

  -- Pierwszy logujący się do tego household zostaje właścicielem
  IF v_household_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE household_id = v_household_id
  ) THEN
    v_role := 'owner';
  ELSE
    v_role := 'member';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, household_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    v_household_id,  -- NULL jeśli brak household (pokaz FamilySetupPage)
    v_role
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Odtwórz trigger (na wypadek gdyby nie istniał)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════
-- KROK 2: Napraw istniejące profile bez household_id
-- ═══════════════════════════════════════════
DO $$
DECLARE
  v_household_id UUID;
  v_has_owner BOOLEAN;
BEGIN
  -- Pobierz istniejący household
  SELECT id INTO v_household_id
  FROM public.households
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_household_id IS NULL THEN
    RAISE NOTICE 'Brak istniejącego household — pomijam przypisanie profili.';
    RETURN;
  END IF;

  -- Przypisz profile bez household_id do tego household
  UPDATE public.profiles
  SET
    household_id = v_household_id,
    role = 'member'
  WHERE household_id IS NULL;

  RAISE NOTICE 'Zaktualizowano % profil(e) — przypisano do household %',
    (SELECT COUNT(*) FROM public.profiles WHERE household_id = v_household_id),
    v_household_id;

  -- Sprawdź czy household ma już właściciela
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE household_id = v_household_id AND role = 'owner'
  ) INTO v_has_owner;

  -- Jeśli nikt nie jest właścicielem — nadaj rolę pierwszemu (najstarszemu) profilowi
  IF NOT v_has_owner THEN
    UPDATE public.profiles
    SET role = 'owner'
    WHERE id = (
      SELECT id FROM public.profiles
      WHERE household_id = v_household_id
      ORDER BY created_at ASC
      LIMIT 1
    );

    RAISE NOTICE 'Nadano rolę owner pierwszemu użytkownikowi.';
  END IF;
END $$;

-- ═══════════════════════════════════════════
-- KROK 3: Upewnij się, że household ma kod zaproszenia
-- ═══════════════════════════════════════════
UPDATE public.households
SET invite_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;
