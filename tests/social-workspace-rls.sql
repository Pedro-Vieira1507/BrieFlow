-- Run on a database with at least two provisioned active owners. No external calls.
-- Every fixture and claim is rolled back, including on assertion failure.
begin;
create temporary table bf_social_rows as
select p.user_id, p.default_organization_id org,
  gen_random_uuid() campaign_id, gen_random_uuid() post_id, gen_random_uuid() account_id,
  row_number() over(order by p.user_id) n
from public.profiles p join public.organization_members m
on m.user_id=p.user_id and m.organization_id=p.default_organization_id and m.status='active'
limit 2;
grant select on bf_social_rows to authenticated, service_role;
do $$ begin
  if (select count(*) from bf_social_rows) <> 2 then raise exception 'requires_two_owners'; end if;
end $$;
insert into public.social_campaigns(id,user_id,organization_id,brief)
select campaign_id,user_id,org,'{"name":"rollback-only isolation test"}' from bf_social_rows;
insert into public.social_accounts(id,user_id,organization_id,channel,external_id,label)
select account_id,user_id,org,'x','test-only','Rollback fixture' from bf_social_rows;
insert into public.social_posts(id,campaign_id,user_id,organization_id,channel,copy)
select post_id,campaign_id,user_id,org,'x','{"title":"test","text":"rollback fixture","productionNotes":""}' from bf_social_rows;
insert into public.social_credentials(account_id,ciphertext)
select account_id,'not-a-real-token' from bf_social_rows;
do $$ begin
  begin
    insert into public.social_posts(campaign_id,user_id,organization_id,channel,copy)
    select a.campaign_id,b.user_id,b.org,'reddit','{}' from bf_social_rows a cross join bf_social_rows b where a.n=1 and b.n=2;
    raise exception 'cross_owner_fk_not_enforced';
  exception when foreign_key_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select user_id::text from bf_social_rows where n=1),true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.social_campaigns where id in (select campaign_id from bf_social_rows)) <> 1 then raise exception 'campaign_isolation_failed'; end if;
  if (select count(*) from public.social_posts where id in (select post_id from bf_social_rows)) <> 1 then raise exception 'post_isolation_failed'; end if;
  begin perform ciphertext from public.social_credentials limit 1; raise exception 'credential_leak'; exception when insufficient_privilege then null; end;
  begin insert into public.social_campaigns(user_id,organization_id,brief) select user_id,org,'{}' from bf_social_rows where n=1; raise exception 'direct_write_allowed'; exception when insufficient_privilege then null; end;
  begin perform public.social_claim_publish(user_id,post_id,1,account_id,'{"consent":true}') from bf_social_rows where n=1; raise exception 'direct_claim_allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role service_role;
do $$ declare f record; begin
  select * into f from bf_social_rows where n=1;
  begin
    perform public.social_claim_publish(f.user_id,f.post_id,null,f.account_id,'{"consent":true}');
    raise exception 'null_version_claimed';
  exception when raise_exception then if sqlerrm <> 'post_conflict' then raise; end if; end;
  perform public.social_claim_publish(f.user_id,f.post_id,1,f.account_id,'{"consent":true}');
  begin
    perform public.social_claim_publish(f.user_id,f.post_id,1,f.account_id,'{"consent":true}');
    raise exception 'duplicate_claimed';
  exception when raise_exception then if sqlerrm <> 'post_conflict' then raise; end if; end;
  if (select count(*) from public.social_publish_attempts where post_id=f.post_id)<>1 then raise exception 'attempt_count'; end if;
end $$;
select 'PASS: owner isolation, composite FK, credential denial, direct-write denial, service-only claim, null-version rejection, duplicate-claim rejection; fixtures rolled back.' as result;
rollback;
