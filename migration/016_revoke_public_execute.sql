-- 016_revoke_public_execute.sql
--
-- Problem (Supabase Security Advisor, 2026-10-11): funkcje SECURITY DEFINER
-- są wykonywalne przez rolę anon przez /rest/v1/rpc/…, mimo że 009 zrobiło
-- `revoke … from anon`. Postgres domyślnie nadaje EXECUTE roli PUBLIC, a anon
-- dziedziczy je przez PUBLIC — samo REVOKE FROM anon nic nie zmienia.
--
--   * match_category_rules — od 009 sprawdza auth.uid(), więc anon i tak nic
--     nie dostanie, ale nie powinien w ogóle móc jej wołać;
--   * handle_new_user — funkcja triggera na auth.users; wywołanie triggera nie
--     wymaga EXECUTE, więc rolom API nie jest potrzebne.
--
-- Pętla po pg_proc obejmuje wszystkie przeciążenia (sygnatura
-- match_category_rules zawiera typ vector z rozszerzenia).
-- Idempotentna. Cofnięcie: migration/rollback_016.sql.

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

-- Weryfikacja:
--   SELECT p.proname, array_to_string(p.proacl, ' ')
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname IN ('match_category_rules','handle_new_user');
--   → bez wpisów "=X/" (PUBLIC) i "anon=X/"
