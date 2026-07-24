-- Faza 6 (fix bezpieczeństwa S1): cross-tenant IDOR w match_category_rules
--
-- Problem: migracja 004 definiuje funkcję jako SECURITY DEFINER (omija RLS)
-- i filtruje po p_household_id PRZEKAZANYM PRZEZ KLIENTA, bez weryfikacji, że
-- wołający należy do tego gospodarstwa. Dodatkowo `grant ... to anon` udostępnia
-- ją niezalogowanym (klucz anon jest publiczny w bundlu JS). Każdy znający cudzy
-- household_id mógł wyciągnąć opisy reguł kategorii (prywatne dane finansowe)
-- innego gospodarstwa.
--
-- Fix:
--   1. Funkcja wyprowadza dozwolone household z auth.uid() i wymusza, że
--      p_household_id musi być gospodarstwem wołającego. Dla obcego household
--      zwraca pusty zbiór (brak wycieku).
--   2. Cofnięcie uprawnienia wykonania dla roli `anon` — kategoryzacja AI
--      dotyczy wyłącznie zalogowanych użytkowników.

create or replace function public.match_category_rules(
  query_embedding extensions.vector(1536),
  match_threshold  float,
  match_count      int,
  p_household_id   uuid
)
returns table (
  id           uuid,
  description  text,
  kategoria    text,
  podkategoria text,
  similarity   float
)
language sql stable security definer
set search_path = public, extensions
as $$
  select
    cr.id,
    cr.description,
    cr.kategoria,
    cr.podkategoria,
    1 - (cr.embedding <=> query_embedding) as similarity
  from public.category_rules cr
  where cr.household_id = p_household_id
    -- Wymuś, że wołający należy do wskazanego gospodarstwa. Bez tego warunku
    -- SECURITY DEFINER pozwalałby czytać reguły dowolnego household.
    and p_household_id in (
      select household_id from public.profiles where id = auth.uid()
    )
    and 1 - (cr.embedding <=> query_embedding) > match_threshold
  order by cr.embedding <=> query_embedding
  limit match_count;
$$;

-- Cofnij dostęp dla niezalogowanych; zostaw tylko dla authenticated.
revoke execute on function public.match_category_rules from anon;
grant execute on function public.match_category_rules to authenticated;
