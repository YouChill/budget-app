-- 019: trzy nowe pozycje słownika (decyzje z rozliczenia wyciągów 09–11.2026).
--
-- Zastosowana na produkcji 2026-11-21 przez Supabase MCP (wersja 20261121174853
-- w supabase_migrations.schema_migrations), więc `supabase db push` ją pominie.
--
--   Przychód / Inne przychody / Darowizny  — darowizny od rodziny, osobno od
--                                           drobnych „Rozliczeń rodzinnych”
--   Wydatek  / Edukacja / Kursy i lekcje   — lekcje, kursy (np. Preply)
--   Wydatek  / Delegacje / Koszty delegacji — wyjazdy służbowe opłacone z własnej
--                                           kieszeni; zwrot od pracodawcy idzie
--                                           do Inne przychody / Delegacje
--
-- Idempotentna, iteruje po wszystkich gospodarstwach (także demo).
-- Te same pozycje: migration/csv/Kategorie.csv, src/data/defaultKategorie.js.

DO $$
DECLARE
  h RECORD;
  nowe TEXT[][] := ARRAY[
    ['Przychód','Inne przychody','Darowizny'],
    ['Wydatek','Edukacja','Kursy i lekcje'],
    ['Wydatek','Delegacje','Koszty delegacji']
  ];
  i INT;
BEGIN
  FOR h IN SELECT id FROM public.households LOOP
    FOR i IN 1 .. array_length(nowe, 1) LOOP
      INSERT INTO public.kategorie (household_id, typ, kategoria, podkategoria)
      SELECT h.id, nowe[i][1], nowe[i][2], nowe[i][3]
      WHERE NOT EXISTS (
        SELECT 1 FROM public.kategorie k
         WHERE k.household_id = h.id
           AND k.typ          = nowe[i][1]
           AND k.kategoria    = nowe[i][2]
           AND k.podkategoria = nowe[i][3]
      );
    END LOOP;
  END LOOP;
END $$;
