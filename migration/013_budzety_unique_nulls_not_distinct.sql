-- 013_budzety_unique_nulls_not_distinct.sql
-- Naprawia ograniczenie unikalne budżetów.
--
-- Powód: `budzety.osoba` i `budzety.miesiac` są nullowalne, a UNIQUE działa
-- w PostgreSQL domyślnie w trybie NULLS DISTINCT — dwa NULL-e nie są uznawane
-- za tę samą wartość. Ograniczenie z migracji 001 nigdy nie wykrywało więc
-- konfliktu dla budżetów wspólnych (osoba = NULL) ani rocznych (miesiac = NULL),
-- przez co ON CONFLICT w setBudget() (src/services/api.js) degenerowało się do
-- zwykłego INSERT-u i każdy ponowny zapis tworzył nowy wiersz.
--
-- WYMAGA PostgreSQL 15+ (UNIQUE NULLS NOT DISTINCT). Sprawdź: show server_version;
--
-- MIGRACJA KASUJE DANE — uruchom najpierw 013_sprawdz_duplikaty.sql i zapisz
-- wynik do pliku poza repozytorium. Duplikaty z różnymi limitami tracą
-- wszystkie wartości poza najnowszą, a rollback ich nie przywraca.
--
-- Idempotentna: DROP … IF EXISTS + ADD daje ten sam stan końcowy przy każdym
-- uruchomieniu (drugi przebieg tylko przebudowuje indeks — tabela jest mała).

BEGIN;

DO $$
BEGIN
  -- Guard wersji. ALTER-y idą przez EXECUTE, żeby guard zdążył zadziałać ZANIM
  -- parser napotka składnię z PG15 — edytor SQL Supabase parsuje cały skrypt
  -- naraz, więc bez EXECUTE dostalibyśmy błąd składni zamiast tego komunikatu.
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION
      'Migracja 013 wymaga PostgreSQL 15+ (UNIQUE NULLS NOT DISTINCT). Wersja: %',
      current_setting('server_version');
  END IF;

  -- 1. Usuń duplikaty, zachowaj najnowszy wiersz w każdej grupie.
  --    Kolejność ma znaczenie: DELETE musi pójść przed ALTER, inaczej
  --    ADD CONSTRAINT wywali się na istniejących duplikatach.
  --    IS NOT DISTINCT FROM dopasowuje NULL-e; para (created_at, id) jako
  --    kryterium rozstrzygające daje deterministyczny wybór nawet wtedy, gdy
  --    duplikaty mają identyczne created_at.
  DELETE FROM public.budzety b
  USING public.budzety keep
  WHERE b.household_id = keep.household_id
    AND b.kategoria    = keep.kategoria
    AND b.zakres       = keep.zakres
    AND b.rok          = keep.rok
    AND b.osoba        IS NOT DISTINCT FROM keep.osoba
    AND b.miesiac      IS NOT DISTINCT FROM keep.miesiac
    AND (COALESCE(b.created_at,    '-infinity'::timestamptz), b.id)
      < (COALESCE(keep.created_at, '-infinity'::timestamptz), keep.id);

  -- 2. Podmień ograniczenie na wariant traktujący NULL-e jak równe.
  --    Lista kolumn musi pozostać dokładnie taka jak `onConflict` w setBudget()
  --    — inaczej PostgREST nie dopasuje indeksu arbitrażowego i upsert znowu
  --    zacznie wstawiać duplikaty.
  EXECUTE 'ALTER TABLE public.budzety DROP CONSTRAINT IF EXISTS budzety_unique_budget';
  EXECUTE 'ALTER TABLE public.budzety ADD CONSTRAINT budzety_unique_budget '
       || 'UNIQUE NULLS NOT DISTINCT (household_id, kategoria, osoba, zakres, rok, miesiac)';
END $$;

COMMIT;

-- Weryfikacja — musi zwrócić zero wierszy:
--   SELECT household_id, kategoria, zakres, rok, miesiac, osoba, count(*)
--   FROM public.budzety GROUP BY 1,2,3,4,5,6 HAVING count(*) > 1;
--
-- Kontrola samego ograniczenia (oczekiwane: indisunique = t, indnullsnotdistinct = t):
--   SELECT i.indisunique, i.indnullsnotdistinct
--   FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--   WHERE c.relname = 'budzety_unique_budget';
