-- Cofa 20261121174853_019_kategorie_darowizny_edukacja_delegacje.sql.
-- Usuwa pozycję tylko w gospodarstwie, które nie ma z nią żadnej transakcji
-- (przed rollbackiem przenieś je ręcznie).

DELETE FROM public.kategorie k
 WHERE (k.typ, k.kategoria, k.podkategoria) IN (
         ('Przychód', 'Inne przychody', 'Darowizny'),
         ('Wydatek', 'Edukacja', 'Kursy i lekcje'),
         ('Wydatek', 'Delegacje', 'Koszty delegacji'))
   AND NOT EXISTS (
         SELECT 1 FROM public.transakcje t
          WHERE t.household_id = k.household_id
            AND t.typ          = k.typ
            AND t.kategoria    = k.kategoria
            AND t.podkategoria = k.podkategoria);
