-- BrieFlow Learning Engine: persist evidence-backed campaign learnings without changing the existing social schema.
-- Learning is stored inside social_campaigns.brief.learning for backward compatibility.
-- This migration adds only a small index to make campaigns with saved learning easy to query later.
create index if not exists social_campaigns_has_learning_idx
  on public.social_campaigns ((brief ? 'learning'))
  where brief ? 'learning';
