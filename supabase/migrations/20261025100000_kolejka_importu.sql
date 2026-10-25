-- Kolejka importu (#129, epik #128): wyciąg trafia do bazy bez kategoryzacji,
-- a kategoryzacja dzieje się później, na wierszach z bazy.
--
--   * transakcje_dowody.status        — nowy / zatwierdzony / wykluczony
--   * transakcje_dowody.opis/osoba    — surowy opis z wyciągu i osoba z importu
--                                       (opis kasowany przy zatwierdzeniu)
--   * transakcje_dowody.rachunek_hmac — HMAC rachunku kontrahenta (#130);
--                                       pełny NRB nigdy nie trafia do bazy
--   * dowody_straznik                 — trigger pilnujący przejść stanów
--                                       i niezmienności pól operacji
--   * kolejka_dodaj(jsonb)            — zapis wyciągu do kolejki
--   * kolejka_zatwierdz(jsonb)        — atomowe zatwierdzenie pozycji
--   * importuj_transakcje(jsonb)      — ten sam kontrakt co w 014, ustawia status
--
-- Wykluczanie i przywracanie: zwykły UPDATE status przez RLS (strażnik pilnuje).
-- Rollback: supabase/rollbacks/20261025100000_kolejka_importu.sql.

-- ═══════════════════════════════════════════
-- 1. KOLUMNY
-- ═══════════════════════════════════════════
ALTER TABLE public.transakcje_dowody
  ADD COLUMN IF NOT EXISTS status           text,
  ADD COLUMN IF NOT EXISTS opis             text,
  ADD COLUMN IF NOT EXISTS osoba            text,
  ADD COLUMN IF NOT EXISTS rachunek_hmac    text,
  ADD COLUMN IF NOT EXISTS utworzono_przez  uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS status_zmieniony timestamptz;

-- Backfill: żaden istniejący wiersz nie może wpaść do kolejki. Dowód bez
-- transakcji to dowód Gmail „tylko_dowod" albo dowód usuniętej transakcji.
UPDATE public.transakcje_dowody
   SET status = CASE WHEN transakcja_id IS NOT NULL THEN 'zatwierdzony' ELSE 'wykluczony' END
 WHERE status IS NULL;

ALTER TABLE public.transakcje_dowody
  ALTER COLUMN status SET DEFAULT 'nowy',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.transakcje_dowody DROP CONSTRAINT IF EXISTS transakcje_dowody_status_check;
ALTER TABLE public.transakcje_dowody ADD CONSTRAINT transakcje_dowody_status_check
  CHECK (status IN ('nowy', 'zatwierdzony', 'wykluczony'));

-- Dowód podpięty do transakcji jest zawsze zatwierdzony (odwrotnie nie:
-- usunięcie transakcji zeruje transakcja_id, status zostaje).
ALTER TABLE public.transakcje_dowody DROP CONSTRAINT IF EXISTS transakcje_dowody_status_transakcja_check;
ALTER TABLE public.transakcje_dowody ADD CONSTRAINT transakcje_dowody_status_transakcja_check
  CHECK (transakcja_id IS NULL OR status = 'zatwierdzony');

ALTER TABLE public.transakcje_dowody DROP CONSTRAINT IF EXISTS transakcje_dowody_opis_check;
ALTER TABLE public.transakcje_dowody ADD CONSTRAINT transakcje_dowody_opis_check
  CHECK (length(opis) <= 1000);

ALTER TABLE public.transakcje_dowody DROP CONSTRAINT IF EXISTS transakcje_dowody_osoba_check;
ALTER TABLE public.transakcje_dowody ADD CONSTRAINT transakcje_dowody_osoba_check
  CHECK (length(osoba) <= 120);

ALTER TABLE public.transakcje_dowody DROP CONSTRAINT IF EXISTS transakcje_dowody_rachunek_hmac_check;
ALTER TABLE public.transakcje_dowody ADD CONSTRAINT transakcje_dowody_rachunek_hmac_check
  CHECK (rachunek_hmac ~ '^[0-9a-f]{64}$');

CREATE INDEX IF NOT EXISTS idx_dowody_kolejka
  ON public.transakcje_dowody (household_id, data) WHERE status = 'nowy';

-- ═══════════════════════════════════════════
-- 2. STRAŻNIK STANÓW
-- ═══════════════════════════════════════════
-- Niezależny od klienta: obowiązuje dla RPC, REST (RLS) i skryptów.
-- Dozwolone przejścia:
--   nowy → zatwierdzony          tylko z transakcja_id
--   nowy ↔ wykluczony            wykluczenie / przywrócenie
--   zatwierdzony → nowy          tylko gdy transakcję usunięto (transakcja_id NULL)
--   zatwierdzony, bez zmiany     transakcja_id → NULL (ON DELETE SET NULL)
--                                albo NULL → id (ponowne podpięcie)
CREATE OR REPLACE FUNCTION public.dowody_straznik()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Audyt: autor z sesji, nie z payloadu (skrypty service_role nie mają sesji).
    NEW.utworzono_przez := COALESCE(auth.uid(), NEW.utworzono_przez);
    IF NEW.status = 'zatwierdzony' AND NEW.transakcja_id IS NULL THEN
      RAISE EXCEPTION 'Dowód zatwierdzony musi wskazywać transakcję' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.household_id    IS DISTINCT FROM OLD.household_id
       OR NEW.zrodlo          IS DISTINCT FROM OLD.zrodlo
       OR NEW.zrodlo_id       IS DISTINCT FROM OLD.zrodlo_id
       OR NEW.data            IS DISTINCT FROM OLD.data
       OR NEW.kwota_pelna     IS DISTINCT FROM OLD.kwota_pelna
       OR NEW.rachunek_hmac   IS DISTINCT FROM OLD.rachunek_hmac
       OR NEW.utworzono_przez IS DISTINCT FROM OLD.utworzono_przez THEN
      RAISE EXCEPTION 'Nie można zmienić danych operacji z wyciągu (źródło, odcisk, data, kwota, rachunek)'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
           (OLD.status = 'nowy'         AND NEW.status = 'zatwierdzony' AND NEW.transakcja_id IS NOT NULL)
        OR (OLD.status = 'nowy'         AND NEW.status = 'wykluczony')
        OR (OLD.status = 'wykluczony'   AND NEW.status = 'nowy')
        OR (OLD.status = 'zatwierdzony' AND NEW.status = 'nowy' AND OLD.transakcja_id IS NULL AND NEW.transakcja_id IS NULL)
      ) THEN
        RAISE EXCEPTION 'Niedozwolona zmiana statusu operacji: % → %', OLD.status, NEW.status
          USING ERRCODE = '23514';
      END IF;
      NEW.status_zmieniony := now();
    ELSIF NEW.transakcja_id IS DISTINCT FROM OLD.transakcja_id
          AND NOT (NEW.transakcja_id IS NULL OR OLD.transakcja_id IS NULL) THEN
      -- Przepięcie zatwierdzonego dowodu na inną transakcję = dwie operacje
      -- z jednego wiersza wyciągu; wymaga powrotu do kolejki.
      RAISE EXCEPTION 'Nie można przepiąć dowodu na inną transakcję' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Retencja: surowy opis zostaje tylko w transakcje.komentarz.
  IF NEW.status = 'zatwierdzony' THEN
    NEW.opis := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS dowody_straznik ON public.transakcje_dowody;
CREATE TRIGGER dowody_straznik BEFORE INSERT OR UPDATE ON public.transakcje_dowody
  FOR EACH ROW EXECUTE FUNCTION public.dowody_straznik();

-- ═══════════════════════════════════════════
-- 3. WSPÓLNE KROKI ZAPISU (importuj_transakcje + kolejka_zatwierdz)
-- ═══════════════════════════════════════════
-- SECURITY INVOKER, household wyłącznie z profilu — wywołane bezpośrednio
-- przez /rest/v1/rpc dają tyle, co INSERT/UPDATE przez RLS.

-- Nowa transakcja z obiektu { data, typ, kwota, kategoria, podkategoria?,
-- osoba, komentarz?, kwota_pelna?, udzial? } → id.
CREATE OR REPLACE FUNCTION public.import_wstaw_transakcje(p_tx jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_hh uuid;
  v_id uuid;
BEGIN
  SELECT household_id INTO v_hh FROM public.profiles WHERE id = auth.uid();
  IF v_hh IS NULL THEN
    RAISE EXCEPTION 'Brak gospodarstwa dla bieżącego użytkownika' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transakcje
    (household_id, data, typ, kwota, kategoria, podkategoria, osoba, komentarz,
     kwota_pelna, udzial, created_by)
  VALUES (
    v_hh,
    (p_tx ->> 'data')::date,
    p_tx ->> 'typ',
    abs((p_tx ->> 'kwota')::numeric),
    p_tx ->> 'kategoria',
    NULLIF(p_tx ->> 'podkategoria', ''),
    p_tx ->> 'osoba',
    NULLIF(p_tx ->> 'komentarz', ''),
    abs((p_tx ->> 'kwota_pelna')::numeric),
    NULLIF(p_tx ->> 'udzial', ''),
    auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Zamknięcie zobowiązania jako opłacone. Tylko własne gospodarstwo i tylko
-- jeszcze bez transakcji: 'oplacone' bez transakcji = radar zamknął je mailem
-- z potwierdzeniem wpłaty, a wiersz z banku przychodzi dopiero teraz.
CREATE OR REPLACE FUNCTION public.import_zamknij_zobowiazanie(p_zobowiazanie_id uuid, p_transakcja_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.zobowiazania
     SET status = 'oplacone', transakcja_id = p_transakcja_id
   WHERE id = p_zobowiazanie_id
     AND household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())
     AND status IN ('otwarte', 'oplacone')
     AND transakcja_id IS NULL;
  RETURN FOUND;
END $$;

-- ═══════════════════════════════════════════
-- 4. importuj_transakcje — kontrakt z 014 bez zmian, dowody dostają status
-- ═══════════════════════════════════════════
-- Zgodność wstecz (expand → contract): obecny import CSV, /api/v1 i skrypt
-- z migration/ dalej działają. Dowód podpięty do transakcji → 'zatwierdzony',
-- dowód bez transakcji („tylko_dowod") → 'wykluczony' (dowód, nie pozycja kolejki).
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
        SELECT d.id, d.transakcja_id, d.status INTO v_istn
        FROM public.transakcje_dowody d
        WHERE d.household_id = v_hh
          AND d.zrodlo = v_dowod ->> 'zrodlo'
          AND d.zrodlo_id = v_dowod ->> 'zrodlo_id';

        IF COALESCE((v_poz ->> 'wymus')::boolean, false)
           AND v_istn.transakcja_id IS NULL
           AND v_tx IS NOT NULL THEN
          v_dowod_id := v_istn.id;            -- transakcja usunięta → odtwarzamy
          -- Wykluczony dowód wraca najpierw do kolejki — strażnik nie
          -- przepuszcza skoku wykluczony → zatwierdzony.
          IF v_istn.status = 'wykluczony' THEN
            UPDATE public.transakcje_dowody SET status = 'nowy' WHERE id = v_dowod_id;
          END IF;
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
      v_tx_id := public.import_wstaw_transakcje(v_tx);
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
      UPDATE public.transakcje_dowody
         SET transakcja_id = v_tx_id, status = 'zatwierdzony'
       WHERE id = v_dowod_id;
    ELSIF v_dowod_id IS NOT NULL THEN
      UPDATE public.transakcje_dowody SET status = 'wykluczony' WHERE id = v_dowod_id;
    END IF;

    -- 3. Zobowiązanie
    IF v_poz ->> 'zobowiazanie_id' IS NOT NULL AND v_tx_id IS NOT NULL THEN
      IF public.import_zamknij_zobowiazanie((v_poz ->> 'zobowiazanie_id')::uuid, v_tx_id) THEN
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

-- ═══════════════════════════════════════════
-- 5. RPC: kolejka_dodaj
-- ═══════════════════════════════════════════
-- p = { "pozycje": [ { zrodlo, zrodlo_id, data, kwota_pelna, opis?, osoba?,
--                      kontrahent?, dokument?, surowe?, rachunek_hmac? } ] }
-- Tylko źródła bankowe. Ponowny import tego samego wyciągu: ON CONFLICT DO
-- NOTHING (w kolejce, zatwierdzone i wykluczone są tak samo pomijane).
-- Zwraca { dodane, pominiete }.
CREATE OR REPLACE FUNCTION public.kolejka_dodaj(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_hh     uuid;
  v_n      int;
  v_dodane int;
BEGIN
  SELECT household_id INTO v_hh FROM public.profiles WHERE id = auth.uid();
  IF v_hh IS NULL THEN
    RAISE EXCEPTION 'Brak gospodarstwa dla bieżącego użytkownika' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p -> 'pozycje') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Oczekiwano {"pozycje": [...]}' USING ERRCODE = '22023';
  END IF;
  v_n := jsonb_array_length(p -> 'pozycje');
  IF v_n > 2000 THEN
    RAISE EXCEPTION 'Maksymalnie 2000 pozycji na wywołanie' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p -> 'pozycje') e
    WHERE jsonb_typeof(e) IS DISTINCT FROM 'object'
       OR (e ->> 'zrodlo') IS NULL
       OR (e ->> 'zrodlo') NOT IN ('millennium', 'pko', 'revolut', 'csv')
  ) THEN
    RAISE EXCEPTION 'Kolejka przyjmuje tylko źródła bankowe: millennium, pko, revolut, csv'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transakcje_dowody
    (household_id, zrodlo, zrodlo_id, data, kwota_pelna, opis, osoba,
     kontrahent, dokument, surowe, rachunek_hmac, status)
  SELECT
    v_hh,
    e ->> 'zrodlo',
    e ->> 'zrodlo_id',
    (e ->> 'data')::date,
    (e ->> 'kwota_pelna')::numeric,
    NULLIF(e ->> 'opis', ''),
    NULLIF(e ->> 'osoba', ''),
    NULLIF(e ->> 'kontrahent', ''),
    NULLIF(e ->> 'dokument', ''),
    NULLIF(e -> 'surowe', 'null'::jsonb),
    NULLIF(e ->> 'rachunek_hmac', ''),
    'nowy'
  FROM jsonb_array_elements(p -> 'pozycje') e
  ON CONFLICT (household_id, zrodlo, zrodlo_id) DO NOTHING;
  GET DIAGNOSTICS v_dodane = ROW_COUNT;

  RETURN jsonb_build_object('dodane', v_dodane, 'pominiete', v_n - v_dodane);
END $$;

-- ═══════════════════════════════════════════
-- 6. RPC: kolejka_zatwierdz
-- ═══════════════════════════════════════════
-- p = { "pozycje": [ {
--   "dowod_id":        uuid,
--   "transakcja":      { data, typ, kwota, kategoria, … } | null,  -- nowa transakcja
--   "transakcja_id":   uuid | null,  -- albo dołącz do istniejącego wpisu
--   "zobowiazanie_id": uuid | null   -- zamknij zobowiązanie jako opłacone
-- } ] }
-- Dowód zablokowany FOR UPDATE: dwa urządzenia zatwierdzające to samo dają
-- jedną transakcję, drugie dostaje 'pominieta'. Cudzy dowód wygląda jak
-- nieistniejący ('pominieta'); cudza transakcja_id → błąd i wycofanie całości.
-- Zwraca { zatwierdzone, dolaczone, pominiete, polaczone,
--          wyniki: [{ status, dowod_id, transakcja_id }] } (kolejność = pozycje).
CREATE OR REPLACE FUNCTION public.kolejka_zatwierdz(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_hh           uuid;
  v_poz          jsonb;
  v_tx           jsonb;
  v_dowod_id     uuid;
  v_tx_id        uuid;
  v_dowod        record;
  v_status       text;
  v_zatwierdzone int := 0;
  v_dolaczone    int := 0;
  v_pominiete    int := 0;
  v_polaczone    int := 0;
  v_wyniki       jsonb := '[]'::jsonb;
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
    v_tx       := NULLIF(v_poz -> 'transakcja', 'null'::jsonb);
    v_dowod_id := (v_poz ->> 'dowod_id')::uuid;
    v_tx_id    := NULL;

    IF v_tx IS NULL AND v_poz ->> 'transakcja_id' IS NULL THEN
      RAISE EXCEPTION 'Pozycja kolejki wymaga "transakcja" albo "transakcja_id"' USING ERRCODE = '22023';
    END IF;

    SELECT d.id, d.status, d.transakcja_id INTO v_dowod
    FROM public.transakcje_dowody d
    WHERE d.id = v_dowod_id AND d.household_id = v_hh
    FOR UPDATE;

    IF NOT FOUND OR v_dowod.status <> 'nowy' THEN
      v_pominiete := v_pominiete + 1;
      v_wyniki := v_wyniki || jsonb_build_object(
        'status', 'pominieta', 'dowod_id', v_dowod_id,
        'transakcja_id', CASE WHEN FOUND THEN v_dowod.transakcja_id END);
      CONTINUE;
    END IF;

    IF v_tx IS NOT NULL THEN
      v_tx_id := public.import_wstaw_transakcje(v_tx);
      v_zatwierdzone := v_zatwierdzone + 1;
      v_status := 'dodana';
    ELSE
      SELECT t.id INTO v_tx_id FROM public.transakcje t
      WHERE t.id = (v_poz ->> 'transakcja_id')::uuid AND t.household_id = v_hh;
      IF v_tx_id IS NULL THEN
        RAISE EXCEPTION 'Transakcja % nie istnieje w gospodarstwie', v_poz ->> 'transakcja_id'
          USING ERRCODE = '23503';
      END IF;
      v_dolaczone := v_dolaczone + 1;
      v_status := 'dolaczona';
    END IF;

    UPDATE public.transakcje_dowody
       SET transakcja_id = v_tx_id, status = 'zatwierdzony'
     WHERE id = v_dowod_id;

    IF v_poz ->> 'zobowiazanie_id' IS NOT NULL
       AND public.import_zamknij_zobowiazanie((v_poz ->> 'zobowiazanie_id')::uuid, v_tx_id) THEN
      v_polaczone := v_polaczone + 1;
    END IF;

    v_wyniki := v_wyniki || jsonb_build_object(
      'status', v_status, 'dowod_id', v_dowod_id, 'transakcja_id', v_tx_id);
  END LOOP;

  RETURN jsonb_build_object(
    'zatwierdzone', v_zatwierdzone,
    'dolaczone', v_dolaczone,
    'pominiete', v_pominiete,
    'polaczone', v_polaczone,
    'wyniki', v_wyniki
  );
END $$;

-- ═══════════════════════════════════════════
-- 7. UPRAWNIENIA
-- ═══════════════════════════════════════════
REVOKE ALL ON FUNCTION public.dowody_straznik() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.import_wstaw_transakcje(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_zamknij_zobowiazanie(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.importuj_transakcje(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kolejka_dodaj(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.kolejka_zatwierdz(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_wstaw_transakcje(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_zamknij_zobowiazanie(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.importuj_transakcje(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kolejka_dodaj(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kolejka_zatwierdz(jsonb) TO authenticated;

-- Weryfikacja:
--   SELECT status, count(*) FROM public.transakcje_dowody GROUP BY 1;   -- bez 'nowy' tuż po wdrożeniu
--   SELECT count(*) FROM public.transakcje_dowody WHERE transakcja_id IS NOT NULL AND status <> 'zatwierdzony';  -- 0
