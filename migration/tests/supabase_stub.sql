-- Minimalna atrapa Supabase do lokalnych testów migracji (NIE uruchamiać w Supabase).
-- Odtwarza tylko to, czego używają migracje: role, auth.uid(), households,
-- profiles i transakcje w kształcie z produkcji (stan 2026-10-11).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;

CREATE TABLE public.households (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  household_id uuid REFERENCES public.households ON DELETE SET NULL,
  display_name text NOT NULL, email text,
  updated_at timestamptz DEFAULT now());
CREATE TABLE public.transakcje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id),
  data date NOT NULL,
  typ text NOT NULL CHECK (typ = ANY (ARRAY['Wydatek','Przychód'])),
  kwota numeric NOT NULL, kategoria text NOT NULL, podkategoria text,
  osoba text NOT NULL, komentarz text,
  created_by uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id);
-- Jak w 003: update własnego profilu (wszystkie kolumny — to łata 015 zawęża).
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
ALTER TABLE public.transakcje ENABLE ROW LEVEL SECURITY;
CREATE POLICY transakcje_all ON public.transakcje FOR ALL
  USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

-- W Supabase domyślne uprawnienia dają rolom API dostęp do nowych tabel w public.
GRANT USAGE ON SCHEMA public TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
