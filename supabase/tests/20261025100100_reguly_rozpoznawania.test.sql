-- Testy reguł rozpoznawania (#133).
\set ON_ERROR_STOP on

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false) \g /dev/null

DO $$ BEGIN
  INSERT INTO reguly_rozpoznawania (household_id, keyword, typ, kategoria, podkategoria)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Biedronka', 'Wydatek', 'Jedzenie', 'Zakupy domowe'),
         ('11111111-1111-1111-1111-111111111111', 'biedronka', 'Przychód', 'Inne przychody', 'Zwroty'),
         ('11111111-1111-1111-1111-111111111111', 'ALLEGRO', NULL, 'Dom', NULL);
  ASSERT (SELECT count(*) FROM reguly_rozpoznawania) = 3, 'ta sama fraza dla różnych typów';
  ASSERT (SELECT created_by FROM reguly_rozpoznawania WHERE keyword = 'ALLEGRO') = 'aaaaaaaa-0000-0000-0000-00000000000a', 'autor';

  -- unikalność bez względu na wielkość liter i spacje
  BEGIN
    INSERT INTO reguly_rozpoznawania (household_id, keyword, typ, kategoria)
    VALUES ('11111111-1111-1111-1111-111111111111', ' BIEDRONKA ', 'Wydatek', 'Jedzenie');
    ASSERT false, 'duplikat powinien być odrzucony';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO reguly_rozpoznawania (household_id, keyword, kategoria)
    VALUES ('11111111-1111-1111-1111-111111111111', 'allegro', 'Dom');
    ASSERT false, 'duplikat z typ NULL powinien być odrzucony';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- CHECK
  BEGIN
    INSERT INTO reguly_rozpoznawania (household_id, keyword, kategoria)
    VALUES ('11111111-1111-1111-1111-111111111111', ' bp ', 'Transport');
    ASSERT false, 'keyword < 3 znaki';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO reguly_rozpoznawania (household_id, keyword, typ, kategoria)
    VALUES ('11111111-1111-1111-1111-111111111111', 'orlen', 'Inny', 'Transport');
    ASSERT false, 'typ spoza listy';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO reguly_rozpoznawania (household_id, keyword, kategoria)
    VALUES ('11111111-1111-1111-1111-111111111111', repeat('x', 101), 'Inne');
    ASSERT false, 'keyword > 100 znaków';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- RLS: nie da się wstawić reguły do cudzego gospodarstwa
  BEGIN
    INSERT INTO reguly_rozpoznawania (household_id, keyword, kategoria)
    VALUES ('22222222-2222-2222-2222-222222222222', 'orlen', 'Transport');
    ASSERT false, 'RLS powinno odrzucić';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ── izolacja: B nie widzi, nie zmienia i nie usuwa reguł A ─────────────────
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', false) \g /dev/null
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM reguly_rozpoznawania) = 0, 'B nie widzi reguł A';
  UPDATE reguly_rozpoznawania SET kategoria = 'Inne';
  DELETE FROM reguly_rozpoznawania;
  -- B może mieć tę samą frazę u siebie
  INSERT INTO reguly_rozpoznawania (household_id, keyword, typ, kategoria)
  VALUES ('22222222-2222-2222-2222-222222222222', 'Biedronka', 'Wydatek', 'Jedzenie');
  BEGIN
    UPDATE reguly_rozpoznawania SET household_id = '11111111-1111-1111-1111-111111111111';
    ASSERT false, 'przeniesienie reguły do cudzego gospodarstwa';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false) \g /dev/null
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM reguly_rozpoznawania) = 3, 'reguły A nietknięte';
  ASSERT (SELECT count(*) FROM reguly_rozpoznawania WHERE kategoria = 'Inne') = 0, 'B nie zmienił reguł A';
END $$;

RESET ROLE;
DO $$ BEGIN
  ASSERT NOT has_table_privilege('anon', 'public.reguly_rozpoznawania', 'SELECT'), 'anon bez dostępu';
  ASSERT has_table_privilege('service_role', 'public.reguly_rozpoznawania', 'DELETE'), 'service_role z dostępem';
END $$;

\echo 'OK: wszystkie testy reguł rozpoznawania przeszły'
