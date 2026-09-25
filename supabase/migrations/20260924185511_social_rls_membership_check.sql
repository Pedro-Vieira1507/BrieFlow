-- Reuse the existing, private, auth.uid-bound membership predicate.
-- Do not expose organization_members or introduce a privileged public function.
do $$
declare table_name text;
begin
  foreach table_name in array array['social_campaigns','social_accounts','social_posts','social_publish_attempts','social_metric_snapshots'] loop
    execute format('alter policy owner_active_member_select on public.%I using (user_id = (select auth.uid()) and (select private.is_organization_member(%I.organization_id)))', table_name, table_name);
  end loop;
end $$;
