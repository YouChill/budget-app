-- Reguły rozpoznawania w bazie (#133, epik #128) zamiast localStorage.
-- „Opis zawiera X → kategoria" — wspólne dla domowników i urządzeń.
-- Deterministyczne, mają pierwszeństwo przed AI (category_rules bez zmian).
-- Rollback: supabase/rollbacks/20261025100100_reguly_rozpoznawania.sql.

CREATE TABLE IF NOT EXISTS public.reguly_rozpoznawania (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id),
  -- Min. 3 znaki: krótsze („bp", „gaz") łapią przypadkowe opisy. Wbudowany
  -- słownik w src/lib/csvImport/kategoryzacja.js zostaje bez zmian.
  keyword      text NOT NULL CHECK (length(btrim(keyword)) BETWEEN 3 AND 100),
  typ          text CHECK (typ IS NULL OR typ IN ('Wydatek', 'Przychód')),
  kategoria    text NOT NULL CHECK (length(kategoria) <= 100),
  podkategoria text CHECK (length(podkategoria) <= 100),
  created_by   uuid DEFAULT auth.uid(),
  created_at   timestamptz DEFAULT now()
);

-- typ NULL = reguła dla obu typów; coalesce, żeby NULL nie omijał unikalności.
CREATE UNIQUE INDEX IF NOT EXISTS reguly_rozpoznawania_uniq
  ON public.reguly_rozpoznawania (household_id, lower(btrim(keyword)), coalesce(typ, ''));

ALTER TABLE public.reguly_rozpoznawania ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reguly_rozpoznawania_select_household ON public.reguly_rozpoznawania;
DROP POLICY IF EXISTS reguly_rozpoznawania_insert_household ON public.reguly_rozpoznawania;
DROP POLICY IF EXISTS reguly_rozpoznawania_update_household ON public.reguly_rozpoznawania;
DROP POLICY IF EXISTS reguly_rozpoznawania_delete_household ON public.reguly_rozpoznawania;
CREATE POLICY reguly_rozpoznawania_select_household ON public.reguly_rozpoznawania FOR SELECT
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY reguly_rozpoznawania_insert_household ON public.reguly_rozpoznawania FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY reguly_rozpoznawania_update_household ON public.reguly_rozpoznawania FOR UPDATE
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY reguly_rozpoznawania_delete_household ON public.reguly_rozpoznawania FOR DELETE
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reguly_rozpoznawania TO authenticated, service_role;
