-- rollback_016.sql — przywraca domyślne EXECUTE dla PUBLIC (stan sprzed 016).
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('match_category_rules', 'handle_new_user')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', f.sig);
  END LOOP;
END $$;
