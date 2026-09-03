begin;

create index if not exists organizations_owner_user_idx
  on public.organizations (owner_user_id);
create index if not exists profiles_default_organization_idx
  on public.profiles (default_organization_id);
create index if not exists organization_members_user_idx
  on public.organization_members (user_id);
create index if not exists organization_members_invited_by_idx
  on public.organization_members (invited_by)
  where invited_by is not null;
create index if not exists subscriptions_plan_idx
  on public.subscriptions (plan_id);

-- Keep the compatibility table private and make its remaining policy scalable.
drop policy if exists "Usuários podem ver seus próprios planos" on public.user_plans;
drop policy if exists legacy_user_plans_select_own on public.user_plans;
create policy legacy_user_plans_select_own
  on public.user_plans
  for select
  to authenticated
  using (user_id = (select auth.uid()));
revoke all on table public.user_plans from anon;
grant select on table public.user_plans to authenticated;

commit;
