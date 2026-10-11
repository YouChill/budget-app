-- Testy migracji 016. Atrapy funkcji o tych samych nazwach (bez pgvector),
-- z domyślnym EXECUTE dla PUBLIC — jak w produkcji przed 016.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public.match_category_rules(p_household_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT 1 $$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public.match_category_rules(uuid) FROM anon;  -- jak 009

DO $$ BEGIN
  ASSERT has_function_privilege('anon', 'public.match_category_rules(uuid)', 'EXECUTE'),
    'przed 016: anon ma EXECUTE przez PUBLIC mimo revoke z 009';
END $$;

\i ../016_revoke_public_execute.sql
\i ../016_revoke_public_execute.sql

DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.match_category_rules(uuid)', 'EXECUTE'), 'anon bez match_category_rules';
  ASSERT has_function_privilege('authenticated', 'public.match_category_rules(uuid)', 'EXECUTE'), 'authenticated z match_category_rules';
  ASSERT NOT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'), 'anon bez handle_new_user';
  ASSERT NOT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'), 'authenticated bez handle_new_user';
END $$;

-- trigger z funkcją bez EXECUTE dla ról API nadal działa przy INSERT jako authenticated
CREATE TABLE public.t016 (id int);
GRANT INSERT ON public.t016 TO authenticated;
CREATE TRIGGER t016_trg AFTER INSERT ON public.t016 FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
SET ROLE authenticated;
INSERT INTO public.t016 VALUES (1);
RESET ROLE;
DROP TABLE public.t016;

\i ../rollback_016.sql
DO $$ BEGIN
  ASSERT has_function_privilege('anon', 'public.match_category_rules(uuid)', 'EXECUTE'), 'rollback przywraca PUBLIC';
END $$;
\i ../016_revoke_public_execute.sql

\echo 'OK: wszystkie testy 016 przeszły'
