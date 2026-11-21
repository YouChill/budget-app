-- 018: nowa kategoria wydatków Działalność / Koszty prowadzenia działalności.
--
-- Zastosowana na produkcji 2026-11-21 przez Supabase MCP (wersja 20261121173634
-- w supabase_migrations.schema_migrations), więc `supabase db push` ją pominie.
--
-- Jeden worek na koszty JDG: inFakt, ZUS, podatki i opłaty z nimi związane.
-- Osobna kategoria (a nie podkategoria w „Inne”), bo budżety są per kategoria,
-- a te koszty rosną po skończeniu ulg ZUS i rozsadzałyby limit „Inne”.
-- Przychód z działalności idzie brutto do Wynagrodzenie / <osoba>.
--
-- Idempotentna, iteruje po wszystkich gospodarstwach (także demo).
-- Te same pozycje: migration/csv/Kategorie.csv, src/data/defaultKategorie.js.

INSERT INTO public.kategorie (household_id, typ, kategoria, podkategoria)
SELECT h.id, 'Wydatek', 'Działalność', 'Koszty prowadzenia działalności'
  FROM public.households h
 WHERE NOT EXISTS (
   SELECT 1 FROM public.kategorie k
    WHERE k.household_id = h.id
      AND k.typ          = 'Wydatek'
      AND k.kategoria    = 'Działalność'
      AND k.podkategoria = 'Koszty prowadzenia działalności');
