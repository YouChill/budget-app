-- 013_sprawdz_duplikaty.sql
-- ZAPYTANIE KONTROLNE — uruchom PRZED migracją 013. Nic nie zmienia (same SELECT-y).
--
-- Migracja 013 kasuje duplikaty budżetów, zachowując w każdej grupie najnowszy
-- wiersz. Jeżeli duplikaty mają różne limity, część wartości bezpowrotnie
-- zniknie. Ten plik pokazuje, co dokładnie się stanie — uruchom go i zapisz
-- wynik do pliku POZA repozytorium (sprawdz_przed_merge.sh blokuje wciąganie
-- danych finansowych do gita).
--
-- Pusty wynik obu zapytań = brak duplikatów, migracja niczego nie skasuje.

-- ── 1. Grupy duplikatów ─────────────────────────────────────────────────────
-- GROUP BY traktuje NULL-e jak równe — dokładnie ta semantyka, którą migracja
-- 013 wprowadza do ograniczenia unikalnego.
SELECT household_id, kategoria, zakres, rok, miesiac, osoba, count(*) AS ile
FROM public.budzety
GROUP BY household_id, kategoria, zakres, rok, miesiac, osoba
HAVING count(*) > 1
ORDER BY kategoria, rok, miesiac, osoba;

-- ── 2. Pełne wiersze z tych grup ────────────────────────────────────────────
-- Kolumna `zostanie` mówi, który wiersz migracja zachowa (najnowszy w grupie,
-- rozstrzygnięcie po parze (created_at, id) — tak samo jak w migracji).
SELECT
  d.id,
  d.kategoria,
  d.zakres,
  d.rok,
  d.miesiac,
  d.osoba,
  d.limit_kwota,
  d.created_at,
  CASE WHEN d.rn = 1 THEN 'ZOSTAJE' ELSE 'do skasowania' END AS zostanie
FROM (
  SELECT
    b.*,
    count(*) OVER grupa AS ile,
    row_number() OVER (
      PARTITION BY b.household_id, b.kategoria, b.zakres, b.rok, b.miesiac, b.osoba
      ORDER BY COALESCE(b.created_at, '-infinity'::timestamptz) DESC, b.id DESC
    ) AS rn
  FROM public.budzety b
  WINDOW grupa AS (
    PARTITION BY b.household_id, b.kategoria, b.zakres, b.rok, b.miesiac, b.osoba
  )
) d
WHERE d.ile > 1
ORDER BY d.kategoria, d.rok, d.miesiac, d.osoba, d.rn;
