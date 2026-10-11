-- Testy migracji 014. Uruchamiane przez run_sql_tests.sh po stub + seed + 014.
-- Każdy blok kończy się ASSERT — pierwszy błąd przerywa przebieg (ON_ERROR_STOP).
\set ON_ERROR_STOP on

-- ── backfill ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ASSERT (SELECT udzial || ' ' || kwota_pelna FROM transakcje WHERE id = '00000000-0000-0000-0000-0000000000a1') = '1/2 265.47', 'backfill 1/2';
  ASSERT (SELECT udzial || ' ' || kwota_pelna FROM transakcje WHERE id = '00000000-0000-0000-0000-0000000000a2') = '4/6 1200.00', 'backfill z separatorem tysięcy';
  ASSERT (SELECT udzial FROM transakcje WHERE id = '00000000-0000-0000-0000-0000000000a3') IS NULL, 'bez śladu → NULL';
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false);

-- ── dwukrotny import tego samego wyciągu ────────────────────────────────────
CREATE TEMP TABLE wynik (n int, r jsonb);
INSERT INTO wynik SELECT 1, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h1","data":"2026-10-01","kwota_pelna":-12.50},
   "transakcja":{"data":"2026-10-01","typ":"Wydatek","kwota":12.50,"kategoria":"Jedzenie","podkategoria":"Kawa","osoba":"Paweł"}},
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h2","data":"2026-10-01","kwota_pelna":-12.50},
   "transakcja":{"data":"2026-10-01","typ":"Wydatek","kwota":12.50,"kategoria":"Jedzenie","podkategoria":"Kawa","osoba":"Paweł"}}
]}');
INSERT INTO wynik SELECT 2, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h1","data":"2026-10-01","kwota_pelna":-12.50},
   "transakcja":{"data":"2026-10-01","typ":"Wydatek","kwota":12.50,"kategoria":"Jedzenie","podkategoria":"Kawa","osoba":"Paweł"}},
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h2","data":"2026-10-01","kwota_pelna":-12.50},
   "transakcja":{"data":"2026-10-01","typ":"Wydatek","kwota":12.50,"kategoria":"Jedzenie","podkategoria":"Kawa","osoba":"Paweł"}}
]}');
DO $$ BEGIN
  ASSERT (SELECT (r->>'dodane')::int FROM wynik WHERE n = 1) = 2, 'pierwszy import: 2 dodane (różne saldo → różne odciski)';
  ASSERT (SELECT (r->>'dodane')::int FROM wynik WHERE n = 2) = 0, 'drugi import: 0 dodanych';
  ASSERT (SELECT (r->>'pominiete')::int FROM wynik WHERE n = 2) = 2, 'drugi import: 2 pominięte';
  ASSERT (SELECT count(*) FROM transakcje WHERE data = '2026-10-01') = 2, 'w bazie 2 transakcje';
  ASSERT (SELECT count(*) FROM transakcje_dowody WHERE transakcja_id IS NOT NULL) = 2, 'dowody podpięte';
END $$;

-- ── zobowiązanie Play zamykane przelewem ────────────────────────────────────
INSERT INTO zobowiazania (id, household_id, kontrahent, dokument, kwota_pelna, termin, kategoria, podkategoria, udzial)
VALUES ('00000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111',
        'play', 'F/60345080/09/26', 119.98, '2026-10-05', 'Rachunki', 'Telefon', '1/2');
TRUNCATE wynik;
INSERT INTO wynik SELECT 3, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h3","data":"2026-10-04","kwota_pelna":-119.98,"dokument":"F/60345080/09/26","kontrahent":"play"},
   "transakcja":{"data":"2026-10-04","typ":"Wydatek","kwota":59.99,"kwota_pelna":119.98,"udzial":"1/2","kategoria":"Rachunki","podkategoria":"Telefon","osoba":"Paweł","komentarz":"Play F/60345080/09/26 [udział 1/2 z 119,98 zł]"},
   "zobowiazanie_id":"00000000-0000-0000-0000-0000000000c1"}
]}');
DO $$ BEGIN
  ASSERT (SELECT (r->>'polaczone')::int FROM wynik) = 1, 'połączone z zobowiązaniem';
  ASSERT (SELECT status FROM zobowiazania WHERE id = '00000000-0000-0000-0000-0000000000c1') = 'oplacone', 'status opłacone';
  ASSERT (SELECT t.kwota || ' ' || t.udzial FROM zobowiazania z JOIN transakcje t ON t.id = z.transakcja_id
          WHERE z.id = '00000000-0000-0000-0000-0000000000c1') = '59.99 1/2', 'transakcja z udziałem';
END $$;

-- ── zobowiązanie zamknięte mailem (oplacone, bez transakcji) łączy się z wyciągiem
INSERT INTO zobowiazania (id, household_id, kontrahent, dokument, kwota_pelna, termin, status)
VALUES ('00000000-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111',
        'pwik', '31139/2026', 265.47, '2026-10-10', 'oplacone');
TRUNCATE wynik;
INSERT INTO wynik SELECT 7, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h-pwik","data":"2026-10-08","kwota_pelna":-265.47},
   "transakcja":{"data":"2026-10-08","typ":"Wydatek","kwota":132.74,"kwota_pelna":265.47,"udzial":"1/2","kategoria":"Rachunki","osoba":"Paweł"},
   "zobowiazanie_id":"00000000-0000-0000-0000-0000000000c2"}]}');
-- drugi wiersz wskazujący to samo zobowiązanie już go nie przejmie
INSERT INTO wynik SELECT 8, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h-pwik-2","data":"2026-10-09","kwota_pelna":-265.47},
   "transakcja":{"data":"2026-10-09","typ":"Wydatek","kwota":132.74,"kategoria":"Rachunki","osoba":"Paweł"},
   "zobowiazanie_id":"00000000-0000-0000-0000-0000000000c2"}]}');
DO $$ BEGIN
  ASSERT (SELECT (r->>'polaczone')::int FROM wynik WHERE n = 7) = 1, 'opłacone mailem → połączone z wyciągiem';
  ASSERT (SELECT (r->>'polaczone')::int FROM wynik WHERE n = 8) = 0, 'drugi wiersz nie przejmuje zobowiązania';
  ASSERT (SELECT t.data FROM zobowiazania z JOIN transakcje t ON t.id = z.transakcja_id
          WHERE z.id = '00000000-0000-0000-0000-0000000000c2') = '2026-10-08', 'zobowiązanie wskazuje pierwszą transakcję';
END $$;

-- ── usunięcie transakcji nie gubi dowodu; wymus odtwarza ────────────────────
DELETE FROM transakcje WHERE id = (SELECT transakcja_id FROM transakcje_dowody WHERE zrodlo_id = 'h1');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM transakcje_dowody WHERE zrodlo_id = 'h1' AND transakcja_id IS NULL) = 1, 'dowód przetrwał usunięcie transakcji';
END $$;
TRUNCATE wynik;
INSERT INTO wynik SELECT 4, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h1","data":"2026-10-01","kwota_pelna":-12.50},
   "transakcja":{"data":"2026-10-01","typ":"Wydatek","kwota":12.50,"kategoria":"Jedzenie","osoba":"Paweł"}}]}');
INSERT INTO wynik SELECT 5, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h1","data":"2026-10-01","kwota_pelna":-12.50},
   "transakcja":{"data":"2026-10-01","typ":"Wydatek","kwota":12.50,"kategoria":"Jedzenie","osoba":"Paweł"},"wymus":true}]}');
DO $$ BEGIN
  ASSERT (SELECT (r->>'pominiete')::int FROM wynik WHERE n = 4) = 1, 'bez wymus — pominięte';
  ASSERT (SELECT (r->>'dodane')::int FROM wynik WHERE n = 5) = 1, 'z wymus — odtworzone';
  ASSERT (SELECT transakcja_id IS NOT NULL FROM transakcje_dowody WHERE zrodlo_id = 'h1'), 'dowód podpięty ponownie';
END $$;

-- ── tryb „tylko dowody": dołączenie do istniejącej transakcji ───────────────
TRUNCATE wynik;
INSERT INTO wynik SELECT 6, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"h-hist","data":"2026-09-14","kwota_pelna":-75},
   "transakcja_id":"00000000-0000-0000-0000-0000000000a3"}]}');
DO $$ BEGIN
  ASSERT (SELECT (r->>'dolaczone')::int FROM wynik) = 1, 'dołączono dowód';
  ASSERT (SELECT count(*) FROM transakcje WHERE data = '2026-09-14') = 1, 'bez nowej transakcji';
END $$;

-- ── izolacja gospodarstw ────────────────────────────────────────────────────
DO $$ BEGIN
  -- cudza transakcja w trybie „tylko dowody" → błąd, nic nie zapisane
  BEGIN
    PERFORM importuj_transakcje('{"pozycje":[{"dowod":{"zrodlo":"csv","zrodlo_id":"x","data":"2026-09-14","kwota_pelna":-10},
      "transakcja_id":"00000000-0000-0000-0000-0000000000b1"}]}');
    ASSERT false, 'cudza transakcja powinna dać błąd';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  ASSERT (SELECT count(*) FROM transakcje_dowody WHERE zrodlo_id = 'x') = 0, 'atomowość: nic nie zapisane';
  -- bezpośredni INSERT dowodu z cudzym transakcja_id → FK (id, household_id) nie przepuszcza
  BEGIN
    INSERT INTO transakcje_dowody (household_id, transakcja_id, zrodlo, zrodlo_id, data, kwota_pelna)
    VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000b1', 'csv', 'y', '2026-09-14', -10);
    ASSERT false, 'FK powinien odrzucić cudzą transakcję';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  -- RLS: nie da się wstawić dowodu do cudzego gospodarstwa
  BEGIN
    INSERT INTO transakcje_dowody (household_id, zrodlo, zrodlo_id, data, kwota_pelna)
    VALUES ('22222222-2222-2222-2222-222222222222', 'csv', 'z', '2026-09-14', -10);
    ASSERT false, 'RLS powinno odrzucić';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM transakcje_dowody) = 0, 'B nie widzi dowodów A';
  ASSERT (SELECT count(*) FROM zobowiazania) = 0, 'B nie widzi zobowiązań A';
  ASSERT (SELECT count(*) FROM istniejace_odciski('millennium', ARRAY['h1','h2'])) = 0, 'B nie dostaje odcisków A';
  -- B nie zamknie zobowiązania A, nawet znając jego id
  PERFORM importuj_transakcje('{"pozycje":[{"transakcja":{"data":"2026-10-04","typ":"Wydatek","kwota":1,"kategoria":"Inne","osoba":"B"},
    "zobowiazanie_id":"00000000-0000-0000-0000-0000000000c1"}]}');
END $$;

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM istniejace_odciski('millennium', ARRAY['h1','h2','nie-ma'])) = 2, 'A widzi swoje odciski';
  ASSERT (SELECT transakcja_id FROM zobowiazania WHERE id = '00000000-0000-0000-0000-0000000000c1')
         IN (SELECT id FROM transakcje), 'zobowiązanie A nadal wskazuje transakcję A';
END $$;

-- ── anon nie ma dostępu do RPC ──────────────────────────────────────────────
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.importuj_transakcje(jsonb)', 'EXECUTE'), 'anon bez EXECUTE';
END $$;

\echo 'OK: wszystkie testy 014 przeszły'
