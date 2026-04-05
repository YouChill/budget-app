-- Migracja 006: System zaproszeń do gospodarstwa (household)
-- Pozwala użytkownikowi zaprosić inną osobę do wspólnego budżetu rodzinnego
--
-- Schemat:
--   - Tabela invitations: token (hex 32 znaki), household_id, created_by, expires_at
--   - RLS: tworzenie/odczyt przez członków household; akceptacja przez RPC
--   - Funkcja accept_invitation(token): waliduje, zmienia household_id usera
--   - Funkcja leave_household(): tworzy nowy household dla usera i go przypisuje

-- ═══════════════════════════════════════════
-- TABELA INVITATIONS
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  used_at     TIMESTAMP WITH TIME ZONE,
  used_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Indeks dla szybkiego wyszukiwania po tokenie
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations (token);

-- ═══════════════════════════════════════════
-- RLS: INVITATIONS
-- ═══════════════════════════════════════════

-- Członkowie household mogą odczytywać zaproszenia swojego household
DROP POLICY IF EXISTS "invitations_select_household" ON public.invitations;
CREATE POLICY "invitations_select_household" ON public.invitations
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Członkowie household mogą tworzyć zaproszenia dla swojego household
DROP POLICY IF EXISTS "invitations_insert_household" ON public.invitations;
CREATE POLICY "invitations_insert_household" ON public.invitations
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Członkowie household mogą usuwać (odwoływać) zaproszenia swojego household
DROP POLICY IF EXISTS "invitations_delete_household" ON public.invitations;
CREATE POLICY "invitations_delete_household" ON public.invitations
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- FUNKCJA: accept_invitation(token)
-- ═══════════════════════════════════════════
-- Waliduje zaproszenie i przypisuje usera do household.
-- SECURITY DEFINER — omija RLS, działa jako właściciel funkcji.
-- Zwraca JSONB: { success, error?, household_id? }

DROP FUNCTION IF EXISTS public.accept_invitation(TEXT);
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_inv        public.invitations%ROWTYPE;
  v_current_hh UUID;
BEGIN
  -- Znajdź ważne zaproszenie
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Zaproszenie jest nieprawidłowe lub wygasło.');
  END IF;

  -- Pobierz obecny household usera
  SELECT household_id INTO v_current_hh
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_current_hh = v_inv.household_id THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Jesteś już członkiem tej rodziny.');
  END IF;

  -- Zmień household usera
  UPDATE public.profiles
  SET household_id = v_inv.household_id,
      updated_at   = NOW()
  WHERE id = auth.uid();

  -- Oznacz zaproszenie jako użyte
  UPDATE public.invitations
  SET used_at = NOW(),
      used_by  = auth.uid()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'success',      true,
    'household_id', v_inv.household_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ═══════════════════════════════════════════
-- FUNKCJA: leave_household()
-- ═══════════════════════════════════════════
-- Tworzy nowy household dla usera i przypisuje go do niego.
-- Stary household pozostaje (inni członkowie nadal go używają).
-- Zwraca JSONB: { success, new_household_id }

DROP FUNCTION IF EXISTS public.leave_household();
CREATE OR REPLACE FUNCTION public.leave_household()
RETURNS JSONB AS $$
DECLARE
  v_user_email     TEXT;
  v_display_name   TEXT;
  v_new_hh_id      UUID;
BEGIN
  SELECT email, display_name INTO v_user_email, v_display_name
  FROM public.profiles
  WHERE id = auth.uid();

  -- Utwórz nowy household dla odchodzącego usera
  INSERT INTO public.households (name)
  VALUES (COALESCE(v_display_name, v_user_email))
  RETURNING id INTO v_new_hh_id;

  -- Zaktualizuj profil
  UPDATE public.profiles
  SET household_id = v_new_hh_id,
      updated_at   = NOW()
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success',          true,
    'new_household_id', v_new_hh_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ═══════════════════════════════════════════
-- HOUSEHOLDS: polityka select dla zapraszanych
-- ═══════════════════════════════════════════
-- Musimy pozwolić użytkownikowi odczytać nazwę household z zaproszenia
-- jeszcze zanim do niego dołączy (żeby wyświetlić "Dołącz do rodziny X?").

DROP POLICY IF EXISTS "households_select_by_invite" ON public.households;
CREATE POLICY "households_select_by_invite" ON public.households
  FOR SELECT USING (
    id IN (
      SELECT household_id FROM public.invitations
      WHERE token IS NOT NULL
        AND used_at IS NULL
        AND expires_at > NOW()
    )
  );

-- ═══════════════════════════════════════════
-- WERYFIKACJA
-- ═══════════════════════════════════════════
-- Przetestuj w SQL Edytorze:
--
-- 1. Zaloguj się jako user A, stwórz zaproszenie:
--    INSERT INTO invitations (household_id, created_by) VALUES ('<hh_id>', auth.uid())
--    RETURNING token;
--
-- 2. Zaloguj się jako user B, zaakceptuj:
--    SELECT accept_invitation('<token>');
--
-- 3. Sprawdź że user B ma teraz household_id user A:
--    SELECT household_id FROM profiles WHERE id = auth.uid();
