-- rollback_014.sql — cofa 014_dowody_i_zobowiazania.sql.
--
-- KASUJE DANE: odciski wgranych wyciągów, zobowiązania z radaru i aliasy
-- kontrahentów. Po rollbacku ponowny import tego samego wyciągu znów
-- utworzy duplikaty. Transakcje zostają; komentarze "[udział …]" też, więc
-- backfill kwota_pelna/udzial da się powtórzyć po ponownym 014.

BEGIN;

DROP FUNCTION IF EXISTS public.importuj_transakcje(jsonb);
DROP FUNCTION IF EXISTS public.istniejace_odciski(text, text[]);

DROP TABLE IF EXISTS public.kontrahenci_aliasy;
DROP TABLE IF EXISTS public.zobowiazania;
DROP TABLE IF EXISTS public.transakcje_dowody;
DROP FUNCTION IF EXISTS public.zobowiazania_touch();

DROP INDEX IF EXISTS public.transakcje_id_household_uniq;

ALTER TABLE public.transakcje DROP CONSTRAINT IF EXISTS transakcje_udzial_check;
ALTER TABLE public.transakcje
  DROP COLUMN IF EXISTS kwota_pelna,
  DROP COLUMN IF EXISTS udzial;

COMMIT;
