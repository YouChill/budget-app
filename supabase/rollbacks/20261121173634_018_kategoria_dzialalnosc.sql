-- Cofa 20261121173634_018_kategoria_dzialalnosc.sql.
-- Usuwa kategorię tylko w gospodarstwie bez transakcji w „Działalność”
-- (przed rollbackiem przenieś je ręcznie). Limit w budzety, jeśli był ustawiony,
-- zostaje i po ponownym wdrożeniu znów zadziała.

DELETE FROM public.kategorie k
 WHERE k.typ = 'Wydatek'
   AND k.kategoria = 'Działalność'
   AND k.podkategoria = 'Koszty prowadzenia działalności'
   AND NOT EXISTS (SELECT 1 FROM public.transakcje t
                    WHERE t.household_id = k.household_id
                      AND t.typ = k.typ AND t.kategoria = k.kategoria);
