-- ROLLBACK: cofnięcie migracji 013
-- Uruchom w Supabase Dashboard → SQL Editor
--
-- Przywraca ograniczenie w wariancie NULLS DISTINCT, czyli stan sprzed
-- migracji 013 — razem z pierwotnym błędem: upsert budżetów wspólnych
-- (osoba = NULL) i rocznych (miesiac = NULL) znowu zacznie tworzyć duplikaty.
--
-- UWAGA: rollback NIE przywraca wierszy skasowanych przez migrację 013.
-- Do tego służy zrzut zrobiony wcześniej przez 013_sprawdz_duplikaty.sql.

ALTER TABLE public.budzety
  DROP CONSTRAINT IF EXISTS budzety_unique_budget;

ALTER TABLE public.budzety
  ADD CONSTRAINT budzety_unique_budget
  UNIQUE (household_id, kategoria, osoba, zakres, rok, miesiac);
