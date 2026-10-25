-- Testy kolejki importu (#129). Uruchamiane przez migration/tests/run_sql_tests.sh
-- po migracjach 014–016 (z ich danymi testowymi) i po tej migracji.
\set ON_ERROR_STOP on

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false);

-- Zatwierdzony dowód do testów przejść (dane z 014 znikają przy jego rollbacku).
DO $$ BEGIN PERFORM importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"w0","data":"2026-10-02","kwota_pelna":-12.50},
   "transakcja":{"data":"2026-10-02","typ":"Wydatek","kwota":12.50,"kategoria":"Jedzenie","osoba":"Paweł"}}]}'); END $$;

-- ── kolejka_dodaj ───────────────────────────────────────────────────────────
CREATE TEMP TABLE k (n int, r jsonb);
INSERT INTO k SELECT 1, kolejka_dodaj('{"pozycje":[
  {"zrodlo":"millennium","zrodlo_id":"q1","data":"2026-10-20","kwota_pelna":-45.10,"opis":"BIEDRONKA 123 KRAKOW","osoba":"Paweł"},
  {"zrodlo":"millennium","zrodlo_id":"q2","data":"2026-10-21","kwota_pelna":-119.98,"opis":"PRZELEW F/1/10/26","osoba":"Paweł",
   "rachunek_hmac":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
  {"zrodlo":"millennium","zrodlo_id":"q3","data":"2026-09-14","kwota_pelna":-75,"opis":"JUDO","osoba":"Paweł"},
  {"zrodlo":"millennium","zrodlo_id":"q1","data":"2026-10-20","kwota_pelna":-45.10,"opis":"BIEDRONKA 123 KRAKOW","osoba":"Paweł"}
]}');
INSERT INTO k SELECT 2, kolejka_dodaj('{"pozycje":[
  {"zrodlo":"millennium","zrodlo_id":"q1","data":"2026-10-20","kwota_pelna":-45.10,"opis":"BIEDRONKA 123 KRAKOW","osoba":"Paweł"},
  {"zrodlo":"millennium","zrodlo_id":"w0","data":"2026-10-02","kwota_pelna":-12.50}
]}');
DO $$ BEGIN
  ASSERT (SELECT r FROM k WHERE n = 1) = '{"dodane":3,"pominiete":1}'::jsonb, 'pierwsze dodanie: 3 + duplikat w partii';
  ASSERT (SELECT r FROM k WHERE n = 2) = '{"dodane":0,"pominiete":2}'::jsonb, 'ponowny import: w kolejce i zaksięgowane pomijane';
  ASSERT (SELECT count(*) FROM transakcje_dowody WHERE status = 'nowy') = 3, '3 pozycje w kolejce';
  ASSERT (SELECT utworzono_przez FROM transakcje_dowody WHERE zrodlo_id = 'q1') = 'aaaaaaaa-0000-0000-0000-00000000000a', 'audyt autora';
  BEGIN
    PERFORM kolejka_dodaj('{"pozycje":[{"zrodlo":"gmail","zrodlo_id":"g1","data":"2026-10-20","kwota_pelna":-1}]}');
    ASSERT false, 'źródło spoza banków powinno dać błąd';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM kolejka_dodaj('{"pozycje":[{"zrodlo":"csv","zrodlo_id":"z1","data":"2026-10-20","kwota_pelna":-1,"rachunek_hmac":"PL61109010140000071219812874"}]}');
    ASSERT false, 'pełny NRB w rachunek_hmac powinien zostać odrzucony';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM kolejka_dodaj(jsonb_build_object('pozycje', (SELECT jsonb_agg(jsonb_build_object(
      'zrodlo','csv','zrodlo_id','x' || i,'data','2026-10-20','kwota_pelna',-1)) FROM generate_series(1, 2001) i)));
    ASSERT false, 'limit 2000 pozycji';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- autor z sesji, nie z payloadu
  INSERT INTO transakcje_dowody (household_id, zrodlo, zrodlo_id, data, kwota_pelna, utworzono_przez)
  VALUES ('11111111-1111-1111-1111-111111111111', 'csv', 'q-audyt', '2026-10-20', -1, 'bbbbbbbb-0000-0000-0000-00000000000b');
  ASSERT (SELECT utworzono_przez FROM transakcje_dowody WHERE zrodlo_id = 'q-audyt') = 'aaaaaaaa-0000-0000-0000-00000000000a',
    'utworzono_przez nadpisane z auth.uid()';
  DELETE FROM transakcje_dowody WHERE zrodlo_id = 'q-audyt';
END $$;

-- ── strażnik: pola operacji są niezmienne ──────────────────────────────────
DO $$ BEGIN
  BEGIN
    UPDATE transakcje_dowody SET kwota_pelna = -1 WHERE zrodlo_id = 'q2';
    ASSERT false, 'zmiana kwoty powinna być odrzucona';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE transakcje_dowody SET zrodlo_id = 'q2-inny' WHERE zrodlo_id = 'q2';
    ASSERT false, 'zmiana odcisku powinna być odrzucona';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE transakcje_dowody SET data = '2026-01-01' WHERE zrodlo_id = 'q2';
    ASSERT false, 'zmiana daty powinna być odrzucona';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE transakcje_dowody SET rachunek_hmac = NULL WHERE zrodlo_id = 'q2';
    ASSERT false, 'zmiana HMAC powinna być odrzucona';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- opis i osoba nie są polami operacji — edycja przechodzi
  UPDATE transakcje_dowody SET osoba = 'Teresa' WHERE zrodlo_id = 'q2';
  ASSERT (SELECT osoba FROM transakcje_dowody WHERE zrodlo_id = 'q2') = 'Teresa', 'osoba edytowalna';
END $$;

-- ── strażnik: przejścia stanów ──────────────────────────────────────────────
DO $$ BEGIN
  -- nowy → zatwierdzony bez transakcji
  BEGIN
    UPDATE transakcje_dowody SET status = 'zatwierdzony' WHERE zrodlo_id = 'q2';
    ASSERT false, 'nowy → zatwierdzony bez transakcji';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- nowy → wykluczony → nowy
  UPDATE transakcje_dowody SET status = 'wykluczony' WHERE zrodlo_id = 'q2';
  ASSERT (SELECT status_zmieniony IS NOT NULL FROM transakcje_dowody WHERE zrodlo_id = 'q2'), 'status_zmieniony ustawiony';
  -- wykluczony → zatwierdzony
  BEGIN
    UPDATE transakcje_dowody SET status = 'zatwierdzony', transakcja_id = '00000000-0000-0000-0000-0000000000a3'
     WHERE zrodlo_id = 'q2';
    ASSERT false, 'wykluczony → zatwierdzony';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE transakcje_dowody SET status = 'nowy' WHERE zrodlo_id = 'q2';
  ASSERT (SELECT status FROM transakcje_dowody WHERE zrodlo_id = 'q2') = 'nowy', 'przywrócenie do kolejki';
  -- dowód w kolejce nie może wskazywać transakcji
  BEGIN
    UPDATE transakcje_dowody SET transakcja_id = '00000000-0000-0000-0000-0000000000a3' WHERE zrodlo_id = 'q2';
    ASSERT false, 'nowy z transakcja_id';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- zatwierdzony (z transakcją) → wykluczony / nowy
  BEGIN
    UPDATE transakcje_dowody SET status = 'wykluczony' WHERE zrodlo_id = 'w0';
    ASSERT false, 'zatwierdzony → wykluczony';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE transakcje_dowody SET status = 'nowy' WHERE zrodlo_id = 'w0';
    ASSERT false, 'zatwierdzony z transakcją → nowy';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- przepięcie na inną transakcję
  BEGIN
    UPDATE transakcje_dowody SET transakcja_id = '00000000-0000-0000-0000-0000000000a3' WHERE zrodlo_id = 'w0';
    ASSERT false, 'przepięcie dowodu';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- bezpośredni INSERT zatwierdzonego bez transakcji
  BEGIN
    INSERT INTO transakcje_dowody (household_id, zrodlo, zrodlo_id, data, kwota_pelna, status)
    VALUES ('11111111-1111-1111-1111-111111111111', 'csv', 'q-zatw', '2026-10-20', -1, 'zatwierdzony');
    ASSERT false, 'insert zatwierdzonego bez transakcji';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- ── kolejka_zatwierdz: dwa razy ten sam dowód → jedna transakcja ────────────
TRUNCATE k;
INSERT INTO k SELECT 3, kolejka_zatwierdz(jsonb_build_object('pozycje', jsonb_build_array(jsonb_build_object(
  'dowod_id', (SELECT id FROM transakcje_dowody WHERE zrodlo_id = 'q1'),
  'transakcja', '{"data":"2026-10-20","typ":"Wydatek","kwota":45.10,"kategoria":"Jedzenie","podkategoria":"Zakupy domowe","osoba":"Paweł","komentarz":"BIEDRONKA 123 KRAKOW"}'::jsonb))));
INSERT INTO k SELECT 4, kolejka_zatwierdz(jsonb_build_object('pozycje', jsonb_build_array(jsonb_build_object(
  'dowod_id', (SELECT id FROM transakcje_dowody WHERE zrodlo_id = 'q1'),
  'transakcja', '{"data":"2026-10-20","typ":"Wydatek","kwota":45.10,"kategoria":"Jedzenie","osoba":"Paweł"}'::jsonb))));
DO $$ BEGIN
  ASSERT (SELECT (r->>'zatwierdzone')::int FROM k WHERE n = 3) = 1, 'zatwierdzone';
  ASSERT (SELECT r->'wyniki'->0->>'status' FROM k WHERE n = 4) = 'pominieta', 'drugi raz: pominięta';
  ASSERT (SELECT (r->>'zatwierdzone')::int FROM k WHERE n = 4) = 0, 'drugi raz: bez nowej transakcji';
  ASSERT (SELECT count(*) FROM transakcje WHERE data = '2026-10-20') = 1, 'jedna transakcja';
  ASSERT (SELECT status FROM transakcje_dowody WHERE zrodlo_id = 'q1') = 'zatwierdzony', 'status zatwierdzony';
  ASSERT (SELECT opis FROM transakcje_dowody WHERE zrodlo_id = 'q1') IS NULL, 'retencja: opis wyzerowany';
  ASSERT (SELECT komentarz FROM transakcje t JOIN transakcje_dowody d ON d.transakcja_id = t.id WHERE d.zrodlo_id = 'q1')
    = 'BIEDRONKA 123 KRAKOW', 'opis w komentarzu transakcji';
  -- opisu nie da się przywrócić na zatwierdzonym dowodzie
  UPDATE transakcje_dowody SET opis = 'X' WHERE zrodlo_id = 'q1';
  ASSERT (SELECT opis FROM transakcje_dowody WHERE zrodlo_id = 'q1') IS NULL, 'zatwierdzony bez opisu';
END $$;

-- ── kolejka_zatwierdz: dołączenie do wpisu ręcznego + zobowiązanie ──────────
INSERT INTO zobowiazania (id, household_id, kontrahent, dokument, kwota_pelna, termin, kategoria, udzial)
VALUES ('00000000-0000-0000-0000-0000000000c3', '11111111-1111-1111-1111-111111111111',
        'play', 'F/1/10/26', 119.98, '2026-10-21', 'Rachunki', '1/2');
TRUNCATE k;
INSERT INTO k SELECT 5, kolejka_zatwierdz(jsonb_build_object('pozycje', jsonb_build_array(
  jsonb_build_object('dowod_id', (SELECT id FROM transakcje_dowody WHERE zrodlo_id = 'q3'),
                     'transakcja_id', '00000000-0000-0000-0000-0000000000a3'),
  jsonb_build_object('dowod_id', (SELECT id FROM transakcje_dowody WHERE zrodlo_id = 'q2'),
                     'zobowiazanie_id', '00000000-0000-0000-0000-0000000000c3',
                     'transakcja', '{"data":"2026-10-21","typ":"Wydatek","kwota":59.99,"kwota_pelna":119.98,"udzial":"1/2","kategoria":"Rachunki","osoba":"Teresa"}'::jsonb))));
DO $$ BEGIN
  ASSERT (SELECT (r->>'dolaczone')::int FROM k) = 1, 'dołączono do istniejącej';
  ASSERT (SELECT (r->>'polaczone')::int FROM k) = 1, 'zobowiązanie zamknięte';
  ASSERT (SELECT transakcja_id FROM transakcje_dowody WHERE zrodlo_id = 'q3') = '00000000-0000-0000-0000-0000000000a3', 'q3 → a3';
  ASSERT (SELECT t.udzial || ' ' || t.kwota_pelna || ' ' || t.osoba FROM zobowiazania z JOIN transakcje t ON t.id = z.transakcja_id
          WHERE z.id = '00000000-0000-0000-0000-0000000000c3') = '1/2 119.98 Teresa', 'transakcja z udziałem';
END $$;

-- ── usunięcie transakcji: dowód zostaje zatwierdzony, może wrócić do kolejki ─
DELETE FROM transakcje WHERE id = (SELECT transakcja_id FROM transakcje_dowody WHERE zrodlo_id = 'q1');
DO $$ BEGIN
  ASSERT (SELECT status || ' ' || coalesce(transakcja_id::text, 'null') FROM transakcje_dowody WHERE zrodlo_id = 'q1')
    = 'zatwierdzony null', 'po usunięciu transakcji';
  UPDATE transakcje_dowody SET status = 'nowy' WHERE zrodlo_id = 'q1';
  ASSERT (SELECT status FROM transakcje_dowody WHERE zrodlo_id = 'q1') = 'nowy', 'powrót do kolejki';
END $$;

-- ── izolacja gospodarstw ────────────────────────────────────────────────────
DO $$ BEGIN
  -- cudza transakcja_id → błąd, całość wycofana
  BEGIN
    PERFORM kolejka_zatwierdz(jsonb_build_object('pozycje', jsonb_build_array(jsonb_build_object(
      'dowod_id', (SELECT id FROM transakcje_dowody WHERE zrodlo_id = 'q1'),
      'transakcja_id', '00000000-0000-0000-0000-0000000000b1'))));
    ASSERT false, 'cudza transakcja powinna dać błąd';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  ASSERT (SELECT status FROM transakcje_dowody WHERE zrodlo_id = 'q1') = 'nowy', 'bez zmian po błędzie';
END $$;

CREATE TEMP TABLE dowod_a AS SELECT id FROM transakcje_dowody WHERE zrodlo_id = 'q1';
GRANT SELECT ON dowod_a TO authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', false);
TRUNCATE k;
INSERT INTO k SELECT 6, kolejka_zatwierdz(jsonb_build_object('pozycje', jsonb_build_array(jsonb_build_object(
  'dowod_id', (SELECT id FROM dowod_a),
  'transakcja', '{"data":"2026-10-20","typ":"Wydatek","kwota":1,"kategoria":"Inne","osoba":"B"}'::jsonb))));
DO $$ BEGIN
  ASSERT (SELECT r->'wyniki'->0->>'status' FROM k) = 'pominieta', 'cudzy dowód: pominięta';
  ASSERT (SELECT r->'wyniki'->0->'transakcja_id' FROM k) = 'null'::jsonb, 'bez wycieku transakcji A';
  ASSERT (SELECT count(*) FROM transakcje WHERE data = '2026-10-20') = 0, 'B nie utworzył transakcji';
  ASSERT (SELECT count(*) FROM transakcje_dowody) = 0, 'B nie widzi kolejki A';
  UPDATE transakcje_dowody SET status = 'wykluczony' WHERE id = (SELECT id FROM dowod_a);
END $$;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false);
DO $$ BEGIN
  ASSERT (SELECT status FROM transakcje_dowody WHERE zrodlo_id = 'q1') = 'nowy', 'B nie wykluczył dowodu A';
END $$;

-- ── zgodność wstecz: importuj_transakcje ustawia status ─────────────────────
TRUNCATE k;
INSERT INTO k SELECT 7, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"millennium","zrodlo_id":"w1","data":"2026-10-22","kwota_pelna":-9.99},
   "transakcja":{"data":"2026-10-22","typ":"Wydatek","kwota":9.99,"kategoria":"Jedzenie","osoba":"Paweł"}},
  {"dowod":{"zrodlo":"gmail","zrodlo_id":"w-dowod","data":"2026-10-22","kwota_pelna":-5}}
]}');
DO $$ BEGIN
  ASSERT (SELECT (r->>'dodane')::int FROM k) = 1, 'import: 1 dodana';
  ASSERT (SELECT status FROM transakcje_dowody WHERE zrodlo_id = 'w1') = 'zatwierdzony', 'import → zatwierdzony';
  ASSERT (SELECT status FROM transakcje_dowody WHERE zrodlo_id = 'w-dowod') = 'wykluczony', 'tylko dowód → wykluczony';
END $$;
-- wymus na wykluczonym dowodzie odtwarza transakcję (jak w 014)
TRUNCATE k;
INSERT INTO k SELECT 8, importuj_transakcje('{"pozycje":[
  {"dowod":{"zrodlo":"gmail","zrodlo_id":"w-dowod","data":"2026-10-22","kwota_pelna":-5},
   "transakcja":{"data":"2026-10-22","typ":"Wydatek","kwota":5,"kategoria":"Inne","osoba":"Paweł"},"wymus":true}]}');
DO $$ BEGIN
  ASSERT (SELECT (r->>'dodane')::int FROM k) = 1, 'wymus: dodana';
  ASSERT (SELECT status FROM transakcje_dowody WHERE zrodlo_id = 'w-dowod') = 'zatwierdzony', 'wymus → zatwierdzony';
END $$;

-- ── uprawnienia ─────────────────────────────────────────────────────────────
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.kolejka_dodaj(jsonb)', 'EXECUTE'), 'anon bez kolejka_dodaj';
  ASSERT NOT has_function_privilege('anon', 'public.kolejka_zatwierdz(jsonb)', 'EXECUTE'), 'anon bez kolejka_zatwierdz';
  ASSERT NOT has_function_privilege('anon', 'public.import_wstaw_transakcje(jsonb)', 'EXECUTE'), 'anon bez import_wstaw_transakcje';
  ASSERT has_function_privilege('authenticated', 'public.kolejka_zatwierdz(jsonb)', 'EXECUTE'), 'authenticated z EXECUTE';
  ASSERT (SELECT prosecdef FROM pg_proc WHERE proname = 'kolejka_zatwierdz') = false, 'SECURITY INVOKER';
END $$;

DROP TABLE k, dowod_a;

-- ── backfill: rollback → migracja na danych ze wszystkimi stanami ──────────
\ir ../rollbacks/20261025100000_kolejka_importu.sql
\ir ../migrations/20261025100000_kolejka_importu.sql
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM transakcje_dowody WHERE status = 'nowy') = 0, 'backfill: nic nie wpada do kolejki';
  ASSERT (SELECT count(*) FROM transakcje_dowody WHERE transakcja_id IS NOT NULL AND status <> 'zatwierdzony') = 0,
    'backfill: dowody z transakcją są zatwierdzone';
  ASSERT (SELECT count(*) FROM transakcje_dowody WHERE transakcja_id IS NULL AND status <> 'wykluczony') = 0,
    'backfill: dowody bez transakcji są wykluczone';
  ASSERT (SELECT count(*) FROM transakcje_dowody WHERE transakcja_id IS NULL) > 0, 'backfill: test obejmuje dowody bez transakcji';
END $$;

\echo 'OK: wszystkie testy kolejki importu przeszły'
