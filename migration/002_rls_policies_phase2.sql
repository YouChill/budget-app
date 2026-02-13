-- Tymczasowe polityki RLS dla fazy 2 (przed wdrożeniem autentykacji)
-- Pozwalają na pełny CRUD z kluczem anon dla wszystkich tabel.
-- W fazie 3 (Autentykacja) zastąpić politykami opartymi na użytkowniku.

-- ═══════════════════════════════════════════
-- TRANSAKCJE
-- ═══════════════════════════════════════════
ALTER TABLE public.transakcje ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transakcje_select_anon" ON public.transakcje
  FOR SELECT TO anon USING (true);

CREATE POLICY "transakcje_insert_anon" ON public.transakcje
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "transakcje_update_anon" ON public.transakcje
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "transakcje_delete_anon" ON public.transakcje
  FOR DELETE TO anon USING (true);

-- ═══════════════════════════════════════════
-- KATEGORIE
-- ═══════════════════════════════════════════
ALTER TABLE public.kategorie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kategorie_select_anon" ON public.kategorie
  FOR SELECT TO anon USING (true);

CREATE POLICY "kategorie_insert_anon" ON public.kategorie
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "kategorie_update_anon" ON public.kategorie
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "kategorie_delete_anon" ON public.kategorie
  FOR DELETE TO anon USING (true);

-- ═══════════════════════════════════════════
-- OSOBY
-- ═══════════════════════════════════════════
ALTER TABLE public.osoby ENABLE ROW LEVEL SECURITY;

CREATE POLICY "osoby_select_anon" ON public.osoby
  FOR SELECT TO anon USING (true);

CREATE POLICY "osoby_insert_anon" ON public.osoby
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "osoby_update_anon" ON public.osoby
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "osoby_delete_anon" ON public.osoby
  FOR DELETE TO anon USING (true);

-- ═══════════════════════════════════════════
-- BUDZETY
-- ═══════════════════════════════════════════
ALTER TABLE public.budzety ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budzety_select_anon" ON public.budzety
  FOR SELECT TO anon USING (true);

CREATE POLICY "budzety_insert_anon" ON public.budzety
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "budzety_update_anon" ON public.budzety
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "budzety_delete_anon" ON public.budzety
  FOR DELETE TO anon USING (true);

-- ═══════════════════════════════════════════
-- HOUSEHOLDS
-- ═══════════════════════════════════════════
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "households_select_anon" ON public.households
  FOR SELECT TO anon USING (true);
