-- Faza 5 (fix bezpieczeństwa): usunięcie permisywnej polityki RLS na
-- public.category_rules.
--
-- Problem: migracja 004 dodała politykę
--     create policy "Anon can access category_rules"
--       on public.category_rules for all using (true) with check (true);
-- Polityka FOR ALL USING(true) WITH CHECK(true) neguje pozostałe polityki
-- household-based. Klucz `anon` jest publiczny (wbudowany w bundle JS), więc
-- KAŻDY mógł odczytać/dodać/usunąć reguły kategorii WSZYSTKICH gospodarstw.
-- Reguły zawierają opisy transakcji (prywatne dane finansowe) → wyciek
-- między gospodarstwami (cross-tenant).
--
-- Fix: usuwamy permisywną politykę. Pozostają polityki z migracji 004 oparte
-- na profiles.household_id (select/insert/delete dla zalogowanych członków
-- gospodarstwa), co jest wystarczające dla działania aplikacji.

DROP POLICY IF EXISTS "Anon can access category_rules" ON public.category_rules;

-- Weryfikacja (opcjonalnie, do podglądu w SQL Editor):
--   SELECT policyname, cmd, roles, qual, with_check
--     FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'category_rules';
