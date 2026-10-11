-- BASELINE: zastosowana na produkcji przed wprowadzeniem Supabase CLI (2026-10-11,
-- przez Supabase MCP). Wpis istnieje w supabase_migrations.schema_migrations, więc
-- `supabase db push` ją pomija. Źródło i testy: migration/
-- Odpowiada migration/016_revoke_public_execute.sql.

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('match_category_rules', 'handle_new_user')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    IF f.proname = 'handle_new_user' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
  END LOOP;
END $$;

