-- Faza 4 (fix 3): Domknij RLS dla zalogowanych uzytkownikow.
--
-- Diagnoza: na transakcje/kategorie/osoby/budzety istnialy wciaz
-- stare polityki "*_anon" z Fazy 2 (USING true, TO anon), a NOWE
-- household-scope'owane polityki z migracji 003 nigdy nie zostaly
-- utworzone (migracja 003 wykonala sie tylko czesciowo). Skutek:
-- zalogowany user (rola "authenticated") nie pasowal do zadnej
-- polityki -> SELECT zwracal 0 wierszy.
--
-- Fix: usuwamy polityki *_anon i tworzymy household-scope'owane
-- (te same co w 003) idempotentnie. Households juz ma policy
-- "households_select_member"; usuwamy tylko "households_select_anon".

-- ──────────────────────────────────────────────
-- DROP starych anon-policies
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "transakcje_select_anon" ON public.transakcje;
DROP POLICY IF EXISTS "transakcje_insert_anon" ON public.transakcje;
DROP POLICY IF EXISTS "transakcje_update_anon" ON public.transakcje;
DROP POLICY IF EXISTS "transakcje_delete_anon" ON public.transakcje;

DROP POLICY IF EXISTS "kategorie_select_anon" ON public.kategorie;
DROP POLICY IF EXISTS "kategorie_insert_anon" ON public.kategorie;
DROP POLICY IF EXISTS "kategorie_update_anon" ON public.kategorie;
DROP POLICY IF EXISTS "kategorie_delete_anon" ON public.kategorie;

DROP POLICY IF EXISTS "osoby_select_anon" ON public.osoby;
DROP POLICY IF EXISTS "osoby_insert_anon" ON public.osoby;
DROP POLICY IF EXISTS "osoby_update_anon" ON public.osoby;
DROP POLICY IF EXISTS "osoby_delete_anon" ON public.osoby;

DROP POLICY IF EXISTS "budzety_select_anon" ON public.budzety;
DROP POLICY IF EXISTS "budzety_insert_anon" ON public.budzety;
DROP POLICY IF EXISTS "budzety_update_anon" ON public.budzety;
DROP POLICY IF EXISTS "budzety_delete_anon" ON public.budzety;

DROP POLICY IF EXISTS "households_select_anon" ON public.households;

-- Drop ewentualne stare wersje household-policies (zeby CREATE byl bezpieczny).
DROP POLICY IF EXISTS "transakcje_select_household" ON public.transakcje;
DROP POLICY IF EXISTS "transakcje_insert_household" ON public.transakcje;
DROP POLICY IF EXISTS "transakcje_update_household" ON public.transakcje;
DROP POLICY IF EXISTS "transakcje_delete_household" ON public.transakcje;

DROP POLICY IF EXISTS "kategorie_select_household" ON public.kategorie;
DROP POLICY IF EXISTS "kategorie_insert_household" ON public.kategorie;
DROP POLICY IF EXISTS "kategorie_update_household" ON public.kategorie;
DROP POLICY IF EXISTS "kategorie_delete_household" ON public.kategorie;

DROP POLICY IF EXISTS "osoby_select_household" ON public.osoby;
DROP POLICY IF EXISTS "osoby_insert_household" ON public.osoby;
DROP POLICY IF EXISTS "osoby_update_household" ON public.osoby;
DROP POLICY IF EXISTS "osoby_delete_household" ON public.osoby;

DROP POLICY IF EXISTS "budzety_select_household" ON public.budzety;
DROP POLICY IF EXISTS "budzety_insert_household" ON public.budzety;
DROP POLICY IF EXISTS "budzety_update_household" ON public.budzety;
DROP POLICY IF EXISTS "budzety_delete_household" ON public.budzety;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- ──────────────────────────────────────────────
-- TRANSAKCJE
-- ──────────────────────────────────────────────
CREATE POLICY "transakcje_select_household" ON public.transakcje
  FOR SELECT TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "transakcje_insert_household" ON public.transakcje
  FOR INSERT TO authenticated WITH CHECK (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "transakcje_update_household" ON public.transakcje
  FOR UPDATE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "transakcje_delete_household" ON public.transakcje
  FOR DELETE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

-- ──────────────────────────────────────────────
-- KATEGORIE
-- ──────────────────────────────────────────────
CREATE POLICY "kategorie_select_household" ON public.kategorie
  FOR SELECT TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "kategorie_insert_household" ON public.kategorie
  FOR INSERT TO authenticated WITH CHECK (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "kategorie_update_household" ON public.kategorie
  FOR UPDATE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "kategorie_delete_household" ON public.kategorie
  FOR DELETE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

-- ──────────────────────────────────────────────
-- OSOBY
-- ──────────────────────────────────────────────
CREATE POLICY "osoby_select_household" ON public.osoby
  FOR SELECT TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "osoby_insert_household" ON public.osoby
  FOR INSERT TO authenticated WITH CHECK (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "osoby_update_household" ON public.osoby
  FOR UPDATE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "osoby_delete_household" ON public.osoby
  FOR DELETE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

-- ──────────────────────────────────────────────
-- BUDZETY
-- ──────────────────────────────────────────────
CREATE POLICY "budzety_select_household" ON public.budzety
  FOR SELECT TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "budzety_insert_household" ON public.budzety
  FOR INSERT TO authenticated WITH CHECK (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "budzety_update_household" ON public.budzety
  FOR UPDATE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "budzety_delete_household" ON public.budzety
  FOR DELETE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

-- ──────────────────────────────────────────────
-- PROFILES: brakujace update_own
-- ──────────────────────────────────────────────
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
