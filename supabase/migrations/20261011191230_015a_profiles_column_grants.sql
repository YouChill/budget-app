-- BASELINE: zastosowana na produkcji przed wprowadzeniem Supabase CLI (2026-10-11,
-- przez Supabase MCP). Wpis istnieje w supabase_migrations.schema_migrations, więc
-- `supabase db push` ją pomija. Źródło i testy: migration/
-- Odpowiada migration/015_profiles_household_lock.sql, część 1.

REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (display_name, updated_at) ON public.profiles TO authenticated;
