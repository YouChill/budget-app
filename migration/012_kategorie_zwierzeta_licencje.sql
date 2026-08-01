-- 010_kategorie_zwierzeta_licencje.sql
-- Druga runda rozszerzenia słownika: 4 podkategorie.
--
-- Powód: analiza zamówień Allegro (03–07.2026) ujawniła wydatki na
-- artykuły dla chomika (karma, ściółka, karuzela) oraz wieczystą licencję
-- na oprogramowanie — żadne nie mieściły się w dotychczasowym słowniku.
--
-- Zakłada wykonanie 009_kategorie_rozszerzenie.sql. Idempotentna.

DO $$
DECLARE
  h RECORD;
  nowe TEXT[][] := ARRAY[
    ['Wydatek','Rozrywka','Oprogramowanie i licencje'],
    ['Wydatek','Zwierzęta','Karma'],
    ['Wydatek','Zwierzęta','Akcesoria'],
    ['Wydatek','Zwierzęta','Weterynarz']
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

-- Weryfikacja: 64 wiersze na każde gospodarstwo.
-- SELECT household_id, count(*) FROM public.kategorie GROUP BY 1;
