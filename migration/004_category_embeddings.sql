-- ============================================================
-- Migration 004: AI Category Rules with pgvector
-- Enables saving and searching category rules via embeddings
-- from OpenAI (text-embedding-3-small, 1536 dims).
--
-- Prerequisites:
--   - Enable the "vector" extension in Supabase Dashboard →
--     Database → Extensions → pgvector
-- ============================================================

-- 1. Enable pgvector (idempotent)
create extension if not exists vector with schema extensions;

-- 2. Category rules table
create table if not exists public.category_rules (
  id          uuid        default gen_random_uuid() primary key,
  household_id uuid       not null references public.households(id) on delete cascade,
  description text        not null,
  embedding   extensions.vector(1536),
  kategoria   text        not null,
  podkategoria text,
  source      text        not null default 'manual'
                          check (source in ('manual', 'import', 'keyword')),
  created_at  timestamptz not null default now()
);

-- 3. Row Level Security
alter table public.category_rules enable row level security;

create policy "Members can select their household category_rules"
  on public.category_rules for select
  using (
    household_id in (
      select household_id from public.profiles where id = auth.uid()
    )
  );

create policy "Members can insert category_rules for their household"
  on public.category_rules for insert
  with check (
    household_id in (
      select household_id from public.profiles where id = auth.uid()
    )
  );

create policy "Members can delete their household category_rules"
  on public.category_rules for delete
  using (
    household_id in (
      select household_id from public.profiles where id = auth.uid()
    )
  );

-- Also allow anon key (fallback / dev mode without auth)
create policy "Anon can access category_rules"
  on public.category_rules for all
  using (true)
  with check (true);

-- 4. IVFFlat index for cosine similarity search
--    (recreate with more lists once you have >10k rows)
create index if not exists category_rules_embedding_idx
  on public.category_rules
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 50);

-- 5. Similarity search function
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
    and 1 - (cr.embedding <=> query_embedding) > match_threshold
  order by cr.embedding <=> query_embedding
  limit match_count;
$$;

-- 6. Grant execute to API roles
grant execute on function public.match_category_rules to authenticated, anon;
