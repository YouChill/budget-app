-- rollback_015.sql — cofa 015_profiles_household_lock.sql.
-- UWAGA: przywraca lukę pozwalającą zmienić sobie household_id.
BEGIN;
DROP TRIGGER IF EXISTS profiles_lock_household ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_lock_household();
REVOKE UPDATE (display_name, updated_at) ON public.profiles FROM authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
COMMIT;
