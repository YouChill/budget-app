-- 011_kategorie_delegacje_ubezpieczenie.sql
-- Trzecia runda: 2 podkategorie.
--
--  * Inne przychody / Delegacje
--      Opennet zwraca koszty podróży służbowych wraz z dietą. Sam zwrot
--      kosztów jest przezroczysty (wykluczamy obie strony), ale dieta
--      zostaje w kieszeni i jest realnym przychodem.
--
--  * Zdrowie / Ubezpieczenie
--      Kategoria istniała już w gospodarstwie produkcyjnym, dodana ręcznie
--      poza migracjami. Wpisujemy ją do słownika, żeby nowe gospodarstwa
--      dostawały ten sam zestaw i żeby Kategorie.csv pozostał źródłem prawdy.
--
-- Zakłada wykonanie 009 i 010. Idempotentna — wstawia tylko brakujące wiersze.

DO $$
DECLARE
  h RECORD;
  nowe TEXT[][] := ARRAY[
    ['Wydatek','Zdrowie','Ubezpieczenie'],
    ['Przychód','Inne przychody','Delegacje']
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

-- Weryfikacja: gospodarstwo produkcyjne powinno mieć 66 wierszy.
-- Gospodarstwo demo może mieć inną liczbę — zostało zasiane starszą
-- wersją słownika i wymaga osobnego wyrównania.
-- SELECT household_id, count(*) FROM public.kategorie GROUP BY 1;