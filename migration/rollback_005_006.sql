-- ROLLBACK: cofnięcie migracji 005 i 006
-- Uruchom w Supabase Dashboard → SQL Editor

-- ═══════════════════════════════════════════
-- 1. Przywróć oryginalne polityki HOUSEHOLDS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "households_select_authenticated" ON public.households;
DROP POLICY IF EXISTS "households_insert_authenticated" ON public.households;
DROP POLICY IF EXISTS "households_update_owner" ON public.households;

-- Przywróć oryginalne polityki z fazy 3
CREATE POLICY "households_select_member" ON public.households
  FOR SELECT USING (
    id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "households_insert_service_role" ON public.households
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "households_update_service_role" ON public.households
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════
-- 2. Przywróć oryginalne polityki PROFILES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_household_members" ON public.profiles;

-- Przywróć oryginalne polityki z fazy 3
CREATE POLICY "profiles_insert_service_role" ON public.profiles
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- ═══════════════════════════════════════════
-- 3. Przywróć oryginalny trigger handle_new_user()
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

-- ═══════════════════════════════════════════
-- 4. Usuń funkcję pomocniczą (migration 005)
-- ═══════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_my_household_id();

-- ═══════════════════════════════════════════
-- 5. Usuń kolumny dodane przez migracje 005/006
-- ═══════════════════════════════════════════
ALTER TABLE public.households DROP COLUMN IF EXISTS invite_code;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
