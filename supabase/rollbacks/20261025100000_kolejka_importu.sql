-- Cofa 20261025100000_kolejka_importu.sql (#129).
--
-- KASUJE DANE: operacje czekające w kolejce (status 'nowy') i wykluczone
-- wiersze kolejki znikają jako pozycje do rozliczenia — po rollbacku zostają
-- jako zwykłe dowody bez transakcji, a ich opisy, osoby i HMAC rachunków
-- przepadają. Zatwierdzone transakcje zostają bez zmian.

DROP FUNCTION IF EXISTS public.kolejka_zatwierdz(jsonb);
DROP FUNCTION IF EXISTS public.kolejka_dodaj(jsonb);

DROP TRIGGER IF EXISTS dowody_straznik ON public.transakcje_dowody;
DROP FUNCTION IF EXISTS public.dowody_straznik();

DROP INDEX IF EXISTS public.idx_dowody_kolejka;
ALTER TABLE public.transakcje_dowody
  DROP CONSTRAINT IF EXISTS transakcje_dowody_status_check,
  DROP CONSTRAINT IF EXISTS transakcje_dowody_status_transakcja_check,
  DROP CONSTRAINT IF EXISTS transakcje_dowody_opis_check,
  DROP CONSTRAINT IF EXISTS transakcje_dowody_osoba_check,
  DROP CONSTRAINT IF EXISTS transakcje_dowody_rachunek_hmac_check;
ALTER TABLE public.transakcje_dowody
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS opis,
  DROP COLUMN IF EXISTS osoba,
  DROP COLUMN IF EXISTS rachunek_hmac,
  DROP COLUMN IF EXISTS utworzono_przez,
  DROP COLUMN IF EXISTS status_zmieniony;

-- importuj_transakcje w wersji z 014 (bez statusów i wspólnych kroków).
CREATE OR REPLACE FUNCTION public.importuj_transakcje(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_hh        uuid;
  v_poz       jsonb;
  v_dowod     jsonb;
  v_tx        jsonb;
  v_dowod_id  uuid;
  v_tx_id     uuid;
  v_istn      record;
  v_status    text;
  v_dodane    int := 0;
  v_pominiete int := 0;
  v_polaczone int := 0;
  v_dolaczone int := 0;
  v_weryf     int := 0;
  v_wyniki    jsonb := '[]'::jsonb;
BEGIN
  SELECT household_id INTO v_hh FROM public.profiles WHERE id = auth.uid();
  IF v_hh IS NULL THEN
    RAISE EXCEPTION 'Brak gospodarstwa dla bieżącego użytkownika' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p -> 'pozycje') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Oczekiwano {"pozycje": [...]}' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p -> 'pozycje') > 2000 THEN
    RAISE EXCEPTION 'Maksymalnie 2000 pozycji na wywołanie' USING ERRCODE = '22023';
  END IF;

  FOR v_poz IN SELECT * FROM jsonb_array_elements(p -> 'pozycje') LOOP
    v_dowod    := NULLIF(v_poz -> 'dowod', 'null'::jsonb);
    v_tx       := NULLIF(v_poz -> 'transakcja', 'null'::jsonb);
    v_dowod_id := NULL;
    v_tx_id    := NULL;
    v_status   := NULL;

    IF COALESCE((v_poz ->> 'do_weryfikacji')::boolean, false) THEN
      v_weryf := v_weryf + 1;
    END IF;

    -- 1. Dowód: ON CONFLICT DO NOTHING = idempotentny import tego samego wyciągu
    IF v_dowod IS NOT NULL THEN
      INSERT INTO public.transakcje_dowody
        (household_id, zrodlo, zrodlo_id, data, kwota_pelna, kontrahent, dokument, surowe)
      VALUES (
        v_hh,
        v_dowod ->> 'zrodlo',
        v_dowod ->> 'zrodlo_id',
        (v_dowod ->> 'data')::date,
        (v_dowod ->> 'kwota_pelna')::numeric,
        v_dowod ->> 'kontrahent',
        v_dowod ->> 'dokument',
        NULLIF(v_dowod -> 'surowe', 'null'::jsonb)
      )
      ON CONFLICT (household_id, zrodlo, zrodlo_id) DO NOTHING
      RETURNING id INTO v_dowod_id;

      IF v_dowod_id IS NULL THEN
        SELECT d.id, d.transakcja_id INTO v_istn
        FROM public.transakcje_dowody d
        WHERE d.household_id = v_hh
          AND d.zrodlo = v_dowod ->> 'zrodlo'
          AND d.zrodlo_id = v_dowod ->> 'zrodlo_id';

        IF COALESCE((v_poz ->> 'wymus')::boolean, false)
           AND v_istn.transakcja_id IS NULL
           AND v_tx IS NOT NULL THEN
          v_dowod_id := v_istn.id;            -- transakcja usunięta → odtwarzamy
        ELSE
          v_pominiete := v_pominiete + 1;
          v_wyniki := v_wyniki || jsonb_build_object(
            'status', 'pominieta', 'transakcja_id', v_istn.transakcja_id, 'dowod_id', v_istn.id);
          CONTINUE;
        END IF;
      END IF;
    END IF;

    -- 2. Transakcja: nowa albo istniejąca (tryb „tylko dowody")
    IF v_tx IS NOT NULL THEN
      INSERT INTO public.transakcje
        (household_id, data, typ, kwota, kategoria, podkategoria, osoba, komentarz,
         kwota_pelna, udzial, created_by)
      VALUES (
        v_hh,
        (v_tx ->> 'data')::date,
        v_tx ->> 'typ',
        abs((v_tx ->> 'kwota')::numeric),
        v_tx ->> 'kategoria',
        NULLIF(v_tx ->> 'podkategoria', ''),
        v_tx ->> 'osoba',
        NULLIF(v_tx ->> 'komentarz', ''),
        abs((v_tx ->> 'kwota_pelna')::numeric),
        NULLIF(v_tx ->> 'udzial', ''),
        auth.uid()
      )
      RETURNING id INTO v_tx_id;
      v_dodane := v_dodane + 1;
      v_status := 'dodana';
    ELSIF v_poz ->> 'transakcja_id' IS NOT NULL THEN
      SELECT t.id INTO v_tx_id FROM public.transakcje t
      WHERE t.id = (v_poz ->> 'transakcja_id')::uuid AND t.household_id = v_hh;
      IF v_tx_id IS NULL THEN
        RAISE EXCEPTION 'Transakcja % nie istnieje w gospodarstwie', v_poz ->> 'transakcja_id'
          USING ERRCODE = '23503';
      END IF;
      v_dolaczone := v_dolaczone + 1;
      v_status := 'dolaczona';
    ELSE
      v_status := 'tylko_dowod';             -- np. dowód wpłaty bez transakcji
    END IF;

    IF v_dowod_id IS NOT NULL AND v_tx_id IS NOT NULL THEN
      UPDATE public.transakcje_dowody SET transakcja_id = v_tx_id WHERE id = v_dowod_id;
    END IF;

    -- 3. Zobowiązanie: tylko z własnego gospodarstwa i tylko jeszcze bez
    --    transakcji. 'oplacone' bez transakcji = radar zamknął je mailem
    --    z potwierdzeniem wpłaty, a wiersz z banku przychodzi dopiero teraz.
    IF v_poz ->> 'zobowiazanie_id' IS NOT NULL AND v_tx_id IS NOT NULL THEN
      UPDATE public.zobowiazania
         SET status = 'oplacone', transakcja_id = v_tx_id
       WHERE id = (v_poz ->> 'zobowiazanie_id')::uuid
         AND household_id = v_hh
         AND status IN ('otwarte', 'oplacone')
         AND transakcja_id IS NULL;
      IF FOUND THEN
        v_polaczone := v_polaczone + 1;
      END IF;
    END IF;

    v_wyniki := v_wyniki || jsonb_build_object(
      'status', v_status, 'transakcja_id', v_tx_id, 'dowod_id', v_dowod_id);
  END LOOP;

  RETURN jsonb_build_object(
    'dodane', v_dodane,
    'pominiete', v_pominiete,
    'polaczone', v_polaczone,
    'dolaczone', v_dolaczone,
    'do_weryfikacji', v_weryf,
    'wyniki', v_wyniki
  );
END $$;

DROP FUNCTION IF EXISTS public.import_zamknij_zobowiazanie(uuid, uuid);
DROP FUNCTION IF EXISTS public.import_wstaw_transakcje(jsonb);

REVOKE ALL ON FUNCTION public.importuj_transakcje(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importuj_transakcje(jsonb) TO authenticated;
