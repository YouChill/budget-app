-- 009_kategorie_rozszerzenie.sql
-- Rozszerzenie słownika kategorii (wariant B): 15 nowych podkategorii.
--
-- Powód: analiza wyciągów bankowych 03–07.2026 wykazała wydatki, które
-- nie mieszczą się w dotychczasowym słowniku i lądowały w
-- „Inne / Nieprzewidziane" (wywóz śmieci, podatki lokalne, darowizny,
-- wypłaty gotówki, transfery własne, terapia, sport, atrakcje).
--
-- Migracja jest IDEMPOTENTNA — wstawia wiersz tylko gdy jeszcze nie
-- istnieje dla danego household. Bezpieczna do wielokrotnego uruchomienia.
-- Nie modyfikuje ani nie usuwa istniejących kategorii i transakcji.

DO $$
DECLARE
  h RECORD;
  nowe TEXT[][] := ARRAY[
    ['Wydatek','Mieszkanie','Wywóz śmieci'],
    ['Wydatek','Mieszkanie','Podatki lokalne'],
    ['Wydatek','Mieszkanie','Ubezpieczenie na życie'],
    ['Wydatek','Dzieci','Rehabilitacja'],
    ['Wydatek','Kredyty/Raty','Pożyczka prywatna'],
    ['Wydatek','Zdrowie','Terapia i rehabilitacja'],
    ['Wydatek','Rozrywka','Sport i aktywność'],
    ['Wydatek','Rozrywka','Atrakcje i bilety'],
    ['Wydatek','Ubrania','Obuwie'],
    ['Wydatek','Inne','Darowizny'],
    ['Wydatek','Inne','Wypłata gotówki'],
    ['Wydatek','Inne','Transfer własny'],
    ['Przychód','Inne przychody','Sprzedaż Allegro'],
    ['Przychód','Inne przychody','Rozliczenia rodzinne'],
    ['Przychód','Inne przychody','Transfer własny']
  ];
  i INT;
BEGIN
  FOR h IN SELECT id FROM public.households LOOP
    FOR i IN 1 .. array_length(nowe, 1) LOOP
      INSERT INTO public.kategorie (household_id, typ, kategoria, podkategoria)
      SELECT h.id, nowe[i][1], nowe[i][2], nowe[i][3]
      WHERE NOT EXISTS (
        SELECT 1 FROM public.kategorie k
         WHERE k.household_id  = h.id
           AND k.typ           = nowe[i][1]
           AND k.kategoria     = nowe[i][2]
           AND k.podkategoria  = nowe[i][3]
      );
    END LOOP;
  END LOOP;
END $$;

-- Weryfikacja: powinno zwrócić 60 wierszy na każde gospodarstwo.
-- SELECT household_id, count(*) FROM public.kategorie GROUP BY 1;

-- ─────────────────────────────────────────────────────────────────
-- OPCJONALNIE — zmiana nazw Osoba1/Osoba2 na realne imiona.
-- Odkomentuj po sprawdzeniu, że transakcje używają tych podkategorii.
--
-- UPDATE public.kategorie SET podkategoria = 'Paweł'
--  WHERE typ='Przychód' AND kategoria='Wynagrodzenie' AND podkategoria='Osoba1';
-- UPDATE public.transakcje SET podkategoria = 'Paweł'
--  WHERE typ='Przychód' AND kategoria='Wynagrodzenie' AND podkategoria='Osoba1';
-- UPDATE public.kategorie SET podkategoria = 'Teresa'
--  WHERE typ='Przychód' AND kategoria='Wynagrodzenie' AND podkategoria='Osoba2';
-- UPDATE public.transakcje SET podkategoria = 'Teresa'
--  WHERE typ='Przychód' AND kategoria='Wynagrodzenie' AND podkategoria='Osoba2';
