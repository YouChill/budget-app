-- Faza 3: Autentykacja z Supabase Auth + Row Level Security
-- Replaces permissive policies from Phase 2 with user-based RLS
-- Adds profiles table and auto-create trigger for new users

-- ═══════════════════════════════════════════
-- PROFILES TABLE (NEW)
-- ═══════════════════════════════════════════
-- Stores user profile information linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  household_id UUID REFERENCES public.households ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Only service role can insert profiles (via trigger)
CREATE POLICY "profiles_insert_service_role" ON public.profiles
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════
-- TRIGGER: Auto-create profile on auth.users signup
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════
-- DROP OLD PERMISSIVE POLICIES (Phase 2)
-- ═══════════════════════════════════════════
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
DROP POLICY IF EXISTS "households_insert_anon" ON public.households;
DROP POLICY IF EXISTS "households_update_anon" ON public.households;
DROP POLICY IF EXISTS "households_delete_anon" ON public.households;

-- ═══════════════════════════════════════════
-- NEW RLS POLICIES: TRANSAKCJE (Phase 3)
-- ═══════════════════════════════════════════
-- Users can only see transactions from their household
CREATE POLICY "transakcje_select_household" ON public.transakcje
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Users can insert transactions only to their household
CREATE POLICY "transakcje_insert_household" ON public.transakcje
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Users can update transactions in their household
CREATE POLICY "transakcje_update_household" ON public.transakcje
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Users can delete transactions in their household
CREATE POLICY "transakcje_delete_household" ON public.transakcje
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- NEW RLS POLICIES: KATEGORIE (Phase 3)
-- ═══════════════════════════════════════════
CREATE POLICY "kategorie_select_household" ON public.kategorie
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "kategorie_insert_household" ON public.kategorie
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "kategorie_update_household" ON public.kategorie
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "kategorie_delete_household" ON public.kategorie
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- NEW RLS POLICIES: OSOBY (Phase 3)
-- ═══════════════════════════════════════════
CREATE POLICY "osoby_select_household" ON public.osoby
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "osoby_insert_household" ON public.osoby
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "osoby_update_household" ON public.osoby
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "osoby_delete_household" ON public.osoby
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- NEW RLS POLICIES: BUDZETY (Phase 3)
-- ═══════════════════════════════════════════
CREATE POLICY "budzety_select_household" ON public.budzety
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "budzety_insert_household" ON public.budzety
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "budzety_update_household" ON public.budzety
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "budzety_delete_household" ON public.budzety
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- NEW RLS POLICIES: HOUSEHOLDS (Phase 3)
-- ═══════════════════════════════════════════
-- Users can see households they belong to
CREATE POLICY "households_select_member" ON public.households
  FOR SELECT USING (
    id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only service role can insert/update households
-- (household creation is an admin operation)
CREATE POLICY "households_insert_service_role" ON public.households
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "households_update_service_role" ON public.households
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════
-- VERIFY: Check existing tables have the columns
-- ═══════════════════════════════════════════
-- Note: If household_id column doesn't exist in any table, add it before running migration
-- ALTER TABLE public.transakcje ADD COLUMN household_id UUID REFERENCES public.households;
-- ALTER TABLE public.kategorie ADD COLUMN household_id UUID REFERENCES public.households;
-- ALTER TABLE public.osoby ADD COLUMN household_id UUID REFERENCES public.households;
-- ALTER TABLE public.budzety ADD COLUMN household_id UUID REFERENCES public.households;
