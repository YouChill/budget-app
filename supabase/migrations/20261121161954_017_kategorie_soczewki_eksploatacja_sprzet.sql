-- 017: trzy nowe podkategorie wydatków.
--
-- Zastosowana na produkcji 2026-11-21 przez Supabase MCP (wersja 20261121161954
-- w supabase_migrations.schema_migrations), więc `supabase db push` ją pominie.
--
-- Powód: rozliczenie wyciągów 09–11.2026 — cykliczne wydatki, które dotąd
-- lądowały w zbyt ogólnych podkategoriach:
--   Zdrowie / Soczewki                — soczewki kontaktowe (wcześniej Leki)
--   Dom / Materiały eksploatacyjne    — filtry Dafi, filtr do ekspresu, worki do odkurzacza
--   Dom / Sprzęt i akcesoria          — akcesoria do telefonu i drobny sprzęt
--
-- Idempotentna, iteruje po wszystkich gospodarstwach (także demo).
-- Te same pozycje: migration/csv/Kategorie.csv, src/data/defaultKategorie.js.

DO $$
DECLARE
  h RECORD;
  nowe TEXT[][] := ARRAY[
    ['Wydatek','Zdrowie','Soczewki'],
    ['Wydatek','Dom','Materiały eksploatacyjne'],
    ['Wydatek','Dom','Sprzęt i akcesoria']
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
