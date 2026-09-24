-- A paid generation may be redeemed once, by its original active member,
-- for at most 24 hours. Lock the subscription before testing refunds/claims.
create or replace function public.authorize_visual_render(
  p_user_id uuid, p_request_id text, p_action text
)
returns table (ok boolean, code text, credits_remaining integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_authorization record;
  v_claimed boolean := false;
begin
  if p_user_id is null or p_request_id is null
     or p_request_id !~ '^[a-zA-Z0-9_-]{8,128}$'
     or p_action is null or p_action not in ('banner','email','social','banner_visual') then
    return query select false, 'invalid_request', null::integer;
    return;
  end if;

  select subscription.* into v_subscription
  from public.subscriptions subscription
  join public.profiles profile on profile.default_organization_id = subscription.organization_id
  join public.organization_members member on member.organization_id = subscription.organization_id
    and member.user_id = profile.user_id and member.status = 'active'
  join public.plan_catalog plan on plan.id = subscription.plan_id and plan.active
  where profile.user_id = p_user_id and subscription.status in ('active','trialing')
    and (case when p_action = 'banner_visual' then 'banner' else p_action end) = any(plan.allowed_formats)
  for update of subscription;

  if not found then
    return query select false, 'image_render_not_authorized', null::integer;
    return;
  end if;

  if p_action = 'banner_visual' then
    select * into v_authorization from public.authorize_generation(
      p_user_id, p_action, p_request_id, jsonb_build_object('source','image-render'));
    if not coalesce(v_authorization.ok, false) then
      return query select false, coalesce(v_authorization.code, 'image_render_not_authorized'), v_authorization.credits_remaining;
      return;
    end if;
    v_subscription.credits_remaining := v_authorization.credits_remaining;
  end if;

  if not exists (
    select 1 from public.credit_ledger debit
    where debit.user_id = p_user_id and debit.organization_id = v_subscription.organization_id
      and debit.request_id = p_request_id and debit.entry_type = 'debit' and debit.action = p_action
      and debit.created_at >= now() - interval '24 hours'
      and not exists (select 1 from public.credit_ledger refund
        where refund.user_id = debit.user_id and refund.request_id = debit.request_id and refund.entry_type = 'refund')
  ) then
    return query select false, 'image_render_not_authorized', null::integer;
    return;
  end if;

  insert into public.visual_render_claims (user_id, request_id, action)
  values (p_user_id, p_request_id, p_action)
  on conflict (user_id, request_id, action) do nothing returning true into v_claimed;
  if not coalesce(v_claimed, false) then
    if p_action = 'banner_visual' then
      perform public.refund_generation(p_user_id, p_request_id, 'visual_claim_conflict');
    end if;
    return query select false, 'duplicate_request', v_subscription.credits_remaining;
    return;
  end if;
  return query select true, 'authorized', v_subscription.credits_remaining;
end;
$$;
revoke all on function public.authorize_visual_render(uuid,text,text) from public, anon, authenticated;
grant execute on function public.authorize_visual_render(uuid,text,text) to service_role;
