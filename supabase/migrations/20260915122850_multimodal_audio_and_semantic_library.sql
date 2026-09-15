-- Multimodal audio workflows and tenant-isolated semantic library search.

begin;

create table if not exists public.asset_embeddings (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_text text not null check (char_length(source_text) between 1 and 20000),
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_embeddings_user_updated_idx
  on public.asset_embeddings (user_id, updated_at desc);

create index if not exists asset_embeddings_organization_idx
  on public.asset_embeddings (organization_id);

create index if not exists asset_embeddings_cosine_idx
  on public.asset_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.asset_embeddings enable row level security;
alter table public.asset_embeddings force row level security;

drop policy if exists asset_embeddings_read_own on public.asset_embeddings;
create policy asset_embeddings_read_own
  on public.asset_embeddings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.asset_embeddings from public, anon, authenticated;
grant select on table public.asset_embeddings to authenticated;
grant all on table public.asset_embeddings to service_role;

create or replace function public.search_asset_embeddings(
  p_query_embedding extensions.vector(768),
  p_match_count integer default 12
)
returns table (
  asset_id uuid,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    ae.asset_id,
    1 - (ae.embedding operator(extensions.<=>) p_query_embedding) as similarity
  from public.asset_embeddings as ae
  where ae.user_id = (select auth.uid())
  order by ae.embedding operator(extensions.<=>) p_query_embedding
  limit least(greatest(coalesce(p_match_count, 12), 1), 50);
$$;

revoke all on function public.search_asset_embeddings(extensions.vector, integer)
  from public, anon;
grant execute on function public.search_asset_embeddings(extensions.vector, integer)
  to authenticated, service_role;

update public.plan_catalog
set generation_costs = generation_costs || jsonb_build_object(
  'voice_briefing', 1,
  'transcription', 2,
  'translation', 3,
  'semantic_search', 1
),
updated_at = now();

commit;
