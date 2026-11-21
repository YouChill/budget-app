-- Testy 017: nowe podkategorie w każdym gospodarstwie, bez duplikatów.
\set ON_ERROR_STOP on

DO $$
DECLARE
  nowe CONSTANT int := 3;
BEGIN
  ASSERT (SELECT count(*) FROM public.kategorie
           WHERE typ = 'Wydatek'
             AND (kategoria, podkategoria) IN (('Zdrowie','Soczewki'),
                                               ('Dom','Materiały eksploatacyjne'),
                                               ('Dom','Sprzęt i akcesoria')))
         = nowe * (SELECT count(*) FROM public.households),
         'każde gospodarstwo ma dokładnie 3 nowe podkategorie';

  ASSERT NOT EXISTS (
    SELECT 1 FROM public.kategorie
     GROUP BY household_id, typ, kategoria, podkategoria HAVING count(*) > 1),
    'brak duplikatów w słowniku';
END $$;
