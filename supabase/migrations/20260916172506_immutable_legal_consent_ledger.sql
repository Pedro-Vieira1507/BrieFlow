-- Snapshot the exact legal documents accepted during sign-up. Auth user
-- metadata is client-supplied and can change later, so it is only the input to
-- this insert-only internal audit record.
create table if not exists private.legal_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  legal_version text not null
    check (legal_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  terms_url text not null
    check (char_length(terms_url) <= 2048 and terms_url ~ '^https://'),
  privacy_url text not null
    check (char_length(privacy_url) <= 2048 and privacy_url ~ '^https://'),
  accepted_at timestamptz not null default now(),
  unique (user_id, legal_version)
);

alter table private.legal_consents enable row level security;
alter table private.legal_consents force row level security;

revoke all on table private.legal_consents from public, anon, authenticated;
grant all on table private.legal_consents to service_role;

create or replace function private.capture_legal_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text := btrim(new.raw_user_meta_data ->> 'legal_consent_version');
  v_terms_url text := btrim(new.raw_user_meta_data ->> 'legal_terms_url');
  v_privacy_url text := btrim(new.raw_user_meta_data ->> 'legal_privacy_url');
begin
  if v_version is null
     or v_terms_url is null
     or v_privacy_url is null
     or v_version !~ '^[A-Za-z0-9._-]{1,64}$'
     or char_length(v_terms_url) > 2048
     or v_terms_url !~ '^https://'
     or char_length(v_privacy_url) > 2048
     or v_privacy_url !~ '^https://' then
    return new;
  end if;

  insert into private.legal_consents (
    user_id,
    legal_version,
    terms_url,
    privacy_url
  ) values (
    new.id,
    v_version,
    v_terms_url,
    v_privacy_url
  )
  on conflict (user_id, legal_version) do nothing;

  return new;
end;
$$;

revoke all on function private.capture_legal_consent()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_legal_consent_brieflow on auth.users;
create trigger on_auth_user_legal_consent_brieflow
after insert on auth.users
for each row execute function private.capture_legal_consent();
