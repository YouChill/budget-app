-- Testy 018: kategoria Działalność w każdym gospodarstwie, raz.
\set ON_ERROR_STOP on

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.kategorie
           WHERE typ = 'Wydatek' AND kategoria = 'Działalność'
             AND podkategoria = 'Koszty prowadzenia działalności')
         = (SELECT count(*) FROM public.households),
         'każde gospodarstwo ma dokładnie jedną pozycję Działalność';
END $$;
