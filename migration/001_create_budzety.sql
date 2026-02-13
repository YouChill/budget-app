-- Tabela budzety (budgets)
-- Odpowiednik zakładki "Budżety" w Google Sheets
-- Kolumny Sheets: Kategoria | Limit | Miesiąc | Rok | Osoba | Zakres | Notatki
CREATE TABLE public.budzety (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  kategoria text NOT NULL,
  limit_kwota numeric NOT NULL DEFAULT 0,
  miesiac integer CHECK (miesiac IS NULL OR (miesiac >= 1 AND miesiac <= 12)),
  rok integer NOT NULL,
  osoba text,
  zakres text NOT NULL DEFAULT 'monthly' CHECK (zakres IN ('monthly', 'yearly')),
  notatki text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT budzety_pkey PRIMARY KEY (id),
  CONSTRAINT budzety_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT budzety_unique_budget UNIQUE (household_id, kategoria, osoba, zakres, rok, miesiac)
);
