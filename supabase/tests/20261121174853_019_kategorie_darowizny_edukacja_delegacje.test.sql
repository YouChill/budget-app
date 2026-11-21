-- Testy 019: trzy nowe pozycje w każdym gospodarstwie, bez duplikatów.
\set ON_ERROR_STOP on

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.kategorie
           WHERE (typ, kategoria, podkategoria) IN (
                   ('Przychód','Inne przychody','Darowizny'),
                   ('Wydatek','Edukacja','Kursy i lekcje'),
                   ('Wydatek','Delegacje','Koszty delegacji')))
         = 3 * (SELECT count(*) FROM public.households),
         'każde gospodarstwo ma dokładnie 3 nowe pozycje';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.kategorie
     GROUP BY household_id, typ, kategoria, podkategoria HAVING count(*) > 1),
    'brak duplikatów w słowniku';
END $$;
