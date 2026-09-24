create table if not exists public.visual_render_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 8 and 128),
  action text not null check (action in ('banner', 'email', 'social', 'banner_visual')),
  claimed_at timestamptz not null default now(),
  primary key (user_id, request_id, action)
);

alter table public.visual_render_claims enable row level security;

create or replace function public.authorize_visual_render(
  p_user_id uuid,
  p_request_id text,
  p_action text
)
returns table (
  ok boolean,
  code text,
  credits_remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean := false;
  v_authorization record;
  v_credits_remaining integer;
begin
  if p_user_id is null
     or p_request_id is null
     or char_length(p_request_id) not between 8 and 128
     or p_action not in ('banner', 'email', 'social', 'banner_visual') then
    return query select false, 'invalid_request', null::integer;
    return;
  end if;

  if p_action = 'banner_visual' then
    select * into v_authorization
    from public.authorize_generation(
      p_user_id,
      p_action,
      p_request_id,
      jsonb_build_object('source', 'image-render')
    );

    if not coalesce(v_authorization.ok, false) then
      return query select false,
        coalesce(v_authorization.code, 'image_render_not_authorized'),
        v_authorization.credits_remaining;
      return;
    end if;
    v_credits_remaining := v_authorization.credits_remaining;
  else
    select debit.balance_after into v_credits_remaining
    from public.credit_ledger debit
    where debit.user_id = p_user_id
      and debit.request_id = p_request_id
      and debit.entry_type = 'debit'
      and debit.action = p_action
      and not exists (
        select 1
        from public.credit_ledger refund
        where refund.user_id = debit.user_id
          and refund.request_id = debit.request_id
          and refund.entry_type = 'refund'
      );

    if not found then
      return query select false, 'image_render_not_authorized', null::integer;
      return;
    end if;
  end if;

  insert into public.visual_render_claims (user_id, request_id, action)
  values (p_user_id, p_request_id, p_action)
  on conflict (user_id, request_id, action) do nothing
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    if p_action = 'banner_visual' then
      perform public.refund_generation(
        p_user_id,
        p_request_id,
        'visual_claim_conflict'
      );
    end if;
    return query select false, 'duplicate_request', v_credits_remaining;
    return;
  end if;

  return query select true, 'authorized', v_credits_remaining;
end;
$$;

revoke all on table public.visual_render_claims from public, anon, authenticated;
grant select, insert, delete on table public.visual_render_claims to service_role;

revoke all on function public.authorize_visual_render(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.authorize_visual_render(uuid, text, text)
  to service_role;
