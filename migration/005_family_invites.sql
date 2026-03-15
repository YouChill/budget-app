-- Faza 5: Zarządzanie rodzinami (households) przez użytkowników
-- Adds invite codes, roles, and self-service household creation/joining

-- ═══════════════════════════════════════════
-- INVITE CODE + ROLE COLUMNS
-- ═══════════════════════════════════════════

-- Add invite_code to households
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Generate invite codes for existing households that don't have one
UPDATE public.households
  SET invite_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
  WHERE invite_code IS NULL;

-- Add role to profiles (owner created the household, member joined via invite)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'
  CHECK (role IN ('owner', 'member'));

-- ═══════════════════════════════════════════
-- SECURITY DEFINER HELPER (avoids RLS recursion)
-- ═══════════════════════════════════════════

-- Function to get current user's household_id without RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ═══════════════════════════════════════════
-- UPDATE PROFILES POLICIES
-- ═══════════════════════════════════════════

-- Allow users to create their own profile (fallback when trigger fails)
DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Replace profiles_select_own with broader household-member view
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_household_members" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR household_id = public.get_my_household_id()
  );

-- ═══════════════════════════════════════════
-- UPDATE HOUSEHOLDS POLICIES
-- ═══════════════════════════════════════════

-- Allow authenticated users to create households (self-service)
DROP POLICY IF EXISTS "households_insert_service_role" ON public.households;
CREATE POLICY "households_insert_authenticated" ON public.households
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow household owners to update their household
DROP POLICY IF EXISTS "households_update_service_role" ON public.households;
CREATE POLICY "households_update_owner" ON public.households
  FOR UPDATE USING (
    id IN (
      SELECT household_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    id IN (
      SELECT household_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Allow any authenticated user to read a household (needed for join-by-invite-code lookup)
DROP POLICY IF EXISTS "households_select_member" ON public.households;
CREATE POLICY "households_select_authenticated" ON public.households
  FOR SELECT USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════
-- UPDATE CATEGORY_RULES POLICIES (if table exists)
-- ═══════════════════════════════════════════

-- Ensure category_rules also uses the same household-based pattern
-- (these may already exist from migration 004, but adding IF NOT EXISTS guards)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_rules') THEN
    -- Drop old anon policies if they exist
    DROP POLICY IF EXISTS "category_rules_select_anon" ON public.category_rules;
    DROP POLICY IF EXISTS "category_rules_insert_anon" ON public.category_rules;
    DROP POLICY IF EXISTS "category_rules_delete_anon" ON public.category_rules;
  END IF;
END $$;
