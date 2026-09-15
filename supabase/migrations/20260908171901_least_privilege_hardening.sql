-- Keep tenant helpers out of the exposed Data API schema and grant web-client
-- roles only the table operations used by the current client.

begin;

create schema if not exists private;

create or replace function private.is_organization_member(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members as member
      where member.organization_id = p_organization_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
    );
$$;

create or replace function private.is_organization_admin(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members as member
      where member.organization_id = p_organization_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
        and member.role in ('owner', 'admin')
    );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke all on function private.is_organization_member(uuid)
  from public, anon;
revoke all on function private.is_organization_admin(uuid)
  from public, anon;
grant execute on function private.is_organization_member(uuid)
  to authenticated, service_role;
grant execute on function private.is_organization_admin(uuid)
  to authenticated, service_role;

alter policy organization_members_member_read
  on public.organization_members
  using ((select private.is_organization_member(organization_id)));

alter policy organizations_member_read
  on public.organizations
  using ((select private.is_organization_member(id)));

alter policy organizations_admin_update
  on public.organizations
  using ((select private.is_organization_admin(id)))
  with check ((select private.is_organization_admin(id)));

alter policy profiles_update_own
  on public.profiles
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (select private.is_organization_member(default_organization_id))
  );

alter policy subscriptions_member_read
  on public.subscriptions
  using ((select private.is_organization_member(organization_id)));

drop function public.is_organization_member(uuid, uuid);
drop function public.is_organization_admin(uuid, uuid);

alter function public.get_user_plan() set search_path = '';

revoke all on table
  public.ai_usage_log,
  public.assets,
  public.credit_ledger,
  public.organization_members,
  public.organizations,
  public.plan_catalog,
  public.profiles,
  public.subscriptions,
  public.user_plans
from public, anon, authenticated;

grant select, insert, update, delete on table public.assets
  to authenticated;

revoke all on sequence
  public.ai_usage_log_id_seq,
  public.credit_ledger_id_seq
from public, anon, authenticated;

-- New public objects start closed and require an explicit grant in the same
-- migration that introduces their browser-facing API.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- The extension is relocatable and no application query relies on a
-- public.vector-qualified name. Existing vector columns retain their type OID.
alter extension vector set schema extensions;

commit;
