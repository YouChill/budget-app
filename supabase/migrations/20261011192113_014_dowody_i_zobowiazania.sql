-- BASELINE: zastosowana na produkcji przed wprowadzeniem Supabase CLI (2026-10-11,
-- przez Supabase MCP). Wpis istnieje w supabase_migrations.schema_migrations, więc
-- `supabase db push` ją pomija. Źródło i testy: migration/
-- Odpowiada migration/014_dowody_i_zobowiazania.sql (wariant bez DROP … IF EXISTS).

DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'Migracja 014 wymaga PostgreSQL 15+. Wersja: %', current_setting('server_version');
  END IF;
END $$;

-- ═══════════════════════════════════════════
-- 1. TRANSAKCJE: kwota przed podziałem
-- ═══════════════════════════════════════════
ALTER TABLE public.transakcje
  ADD COLUMN IF NOT EXISTS kwota_pelna numeric(12,2),
  ADD COLUMN IF NOT EXISTS udzial      text;

ALTER TABLE public.transakcje ADD CONSTRAINT transakcje_udzial_check
  CHECK (udzial IS NULL OR udzial ~ '^[1-9][0-9]*/[1-9][0-9]*$');

-- Para (id, household_id) jako cel kluczy obcych z tabel poniżej — gwarantuje,
-- że dowód i zobowiązanie wskazują transakcję z TEGO SAMEGO gospodarstwa.
-- Sam FK omija RLS, więc bez tego dało się podpiąć cudze UUID.
CREATE UNIQUE INDEX IF NOT EXISTS transakcje_id_household_uniq
  ON public.transakcje (id, household_id);

-- ═══════════════════════════════════════════
-- 2. DOWODY
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.transakcje_dowody (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   uuid NOT NULL REFERENCES public.households(id),
  transakcja_id  uuid,
  zrodlo         text NOT NULL
                 CHECK (zrodlo IN ('reczne','millennium','pko','revolut','csv','gmail','allegro')),
  zrodlo_id      text NOT NULL CHECK (length(zrodlo_id) BETWEEN 1 AND 200),
  data           date NOT NULL,
  kwota_pelna    numeric(12,2) NOT NULL,      -- zawsze brutto ze źródła, ze znakiem
  kontrahent     text,
  dokument       text,
  -- Minimum do audytu. NIE zapisujemy pełnych numerów kont — tylko 4 ostatnie cyfry.
  surowe         jsonb,
  created_at     timestamptz DEFAULT now(),
  CONSTRAINT transakcje_dowody_zrodlo_uniq UNIQUE (household_id, zrodlo, zrodlo_id),
  -- Usunięcie transakcji zeruje tylko transakcja_id — dowód zostaje, więc ten
  -- sam wyciąg nadal jest rozpoznawany jako już wgrany.
  CONSTRAINT transakcje_dowody_transakcja_fkey FOREIGN KEY (transakcja_id, household_id)
    REFERENCES public.transakcje (id, household_id) ON DELETE SET NULL (transakcja_id)
);

CREATE INDEX IF NOT EXISTS idx_dowody_transakcja ON public.transakcje_dowody (transakcja_id);
CREATE INDEX IF NOT EXISTS idx_dowody_household_data ON public.transakcje_dowody (household_id, data);

-- ═══════════════════════════════════════════
-- 3. ZOBOWIĄZANIA (radar Gmail)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.zobowiazania (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     uuid NOT NULL REFERENCES public.households(id),
  kontrahent       text NOT NULL,                 -- play, pim, tauron, apple…
  dokument         text NOT NULL,                 -- F/60345080/09/26
  kwota_pelna      numeric(12,2),                 -- NULL = brak w mailu (TAURON)
  data_wystawienia date,
  termin           date,                          -- auto_karta: dzień odnowienia
  sposob           text NOT NULL DEFAULT 'przelew' CHECK (sposob IN ('przelew','auto_karta')),
  kategoria        text,
  podkategoria     text,
  udzial           text CHECK (udzial IS NULL OR udzial ~ '^[1-9][0-9]*/[1-9][0-9]*$'),
  status           text NOT NULL DEFAULT 'otwarte' CHECK (status IN ('otwarte','oplacone','anulowane')),
  transakcja_id    uuid,
  gmail_thread     text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  CONSTRAINT zobowiazania_dokument_uniq UNIQUE (household_id, kontrahent, dokument),
  CONSTRAINT zobowiazania_transakcja_fkey FOREIGN KEY (transakcja_id, household_id)
    REFERENCES public.transakcje (id, household_id) ON DELETE SET NULL (transakcja_id)
);

-- Kandydaci do parowania: otwarte i opłacone mailem, jeszcze bez transakcji
CREATE INDEX IF NOT EXISTS idx_zobowiazania_do_parowania
  ON public.zobowiazania (household_id, termin) WHERE transakcja_id IS NULL;

CREATE OR REPLACE FUNCTION public.zobowiazania_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER zobowiazania_touch BEFORE UPDATE ON public.zobowiazania
  FOR EACH ROW EXECUTE FUNCTION public.zobowiazania_touch();

-- ═══════════════════════════════════════════
-- 4. ALIASY KONTRAHENTÓW
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.kontrahenci_aliasy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid NOT NULL REFERENCES public.households(id),
  wzorzec       text NOT NULL,     -- rachunek: same cyfry NRB; opis: fragment, np. APPLE.COM/BILL
  typ_wzorca    text NOT NULL CHECK (typ_wzorca IN ('rachunek','opis')),
  kontrahent    text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT kontrahenci_aliasy_uniq UNIQUE (household_id, typ_wzorca, wzorzec)
);

-- ═══════════════════════════════════════════
-- 5. RLS — jak transakcje (003): gospodarstwo z profiles
-- ═══════════════════════════════════════════
DO $$
DECLARE
  t   text;
  hh  constant text := 'household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid())';
BEGIN
  FOREACH t IN ARRAY ARRAY['transakcje_dowody','zobowiazania','kontrahenci_aliasy'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (%s)', t || '_select_household', t, hh);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)', t || '_insert_household', t, hh);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)', t || '_update_household', t, hh, hh);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (%s)', t || '_delete_household', t, hh);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════
-- 6. RPC: istniejace_odciski
-- ═══════════════════════════════════════════
-- POST zamiast GET ?zrodlo_id=in.(…) — 500 odcisków sha256 nie mieści się w URL.
CREATE OR REPLACE FUNCTION public.istniejace_odciski(p_zrodlo text, p_ids text[])
RETURNS TABLE (zrodlo_id text, transakcja_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT d.zrodlo_id, d.transakcja_id
  FROM public.transakcje_dowody d
  WHERE d.zrodlo = p_zrodlo
    AND d.zrodlo_id = ANY (p_ids)
    AND d.household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid());
$$;

-- ═══════════════════════════════════════════
-- 7. RPC: importuj_transakcje
-- ═══════════════════════════════════════════
-- Jedna logika zapisu dla UI (CSVImport), /api/v1 i skryptów w migration/.
-- SECURITY INVOKER — RLS obowiązuje; household_id wyłącznie z profilu.
-- Całość w jednej transakcji: błąd w dowolnej pozycji wycofuje wszystkie.
--
-- p = { "pozycje": [ {
--   "dowod":          { zrodlo, zrodlo_id, data, kwota_pelna, kontrahent?, dokument?, surowe? } | null,
--   "transakcja":     { data, typ, kwota, kategoria, podkategoria?, osoba, komentarz?, kwota_pelna?, udzial? } | null,
--   "transakcja_id":  uuid | null,  -- dołącz dowód do istniejącej transakcji (bez tworzenia nowej)
--   "zobowiazanie_id":uuid | null,  -- zamknij zobowiązanie jako opłacone
--   "do_weryfikacji": bool,         -- tylko do raportu
--   "wymus":          bool          -- dowód istnieje, ale jego transakcję usunięto → utwórz ponownie
-- } ] }
--
-- Zwraca { dodane, pominiete, polaczone, dolaczone, do_weryfikacji,
--          wyniki: [{ status, transakcja_id, dowod_id }] } (kolejność = pozycje).
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

REVOKE ALL ON FUNCTION public.importuj_transakcje(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.istniejace_odciski(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importuj_transakcje(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.istniejace_odciski(text, text[]) TO authenticated;

-- ═══════════════════════════════════════════
-- 8. BACKFILL kwota_pelna / udzial z komentarzy
-- ═══════════════════════════════════════════
-- "PWIK faktura 9029/2026 [udział 1/2 z 265,47 zł]" → udzial='1/2', kwota_pelna=265.47
-- Tylko wiersze jeszcze nieuzupełnione — ponowne uruchomienie niczego nie zmienia.
UPDATE public.transakcje t
SET udzial      = m[1],
    kwota_pelna = replace(regexp_replace(m[2], '[[:space:]\u00a0]', '', 'g'), ',', '.')::numeric
FROM (
  SELECT id, regexp_match(komentarz, '\[udział (\d+/\d+) z ([\d[:space:]\u00a0]+,\d{2}) zł\]') AS m
  FROM public.transakcje
  WHERE komentarz LIKE '%[udział %' AND kwota_pelna IS NULL
) s
WHERE t.id = s.id AND s.m IS NOT NULL;

