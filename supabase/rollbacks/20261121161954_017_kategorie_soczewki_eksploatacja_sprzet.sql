-- Cofa 20261121161954_017_kategorie_soczewki_eksploatacja_sprzet.sql.
-- Usuwa podkategorię tylko w gospodarstwie, które nie ma z nią żadnej transakcji —
-- inaczej transakcje zostałyby z kategorią spoza słownika. Budżety są na poziomie
-- kategorii (Dom, Zdrowie), więc ich ta zmiana nie dotyczy.
-- Przed rollbackiem przenieś transakcje ręcznie (np. Soczewki → Zdrowie / Leki).

DELETE FROM public.kategorie k
 WHERE k.typ = 'Wydatek'
   AND (k.kategoria, k.podkategoria) IN (
         ('Zdrowie', 'Soczewki'),
         ('Dom', 'Materiały eksploatacyjne'),
         ('Dom', 'Sprzęt i akcesoria'))
   AND NOT EXISTS (
         SELECT 1 FROM public.transakcje t
          WHERE t.household_id = k.household_id
            AND t.typ          = k.typ
            AND t.kategoria    = k.kategoria
            AND t.podkategoria = k.podkategoria);
