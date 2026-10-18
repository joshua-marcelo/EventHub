-- Initial event categories. Data only: no schema, RLS, function or permission changes.
-- Idempotent: rows matching an existing slug OR name (case-insensitive) are skipped and
-- never updated, so Admin edits in Reference Data and existing event references are preserved.
insert into public.event_categories (slug, name, sort_order)
select v.slug, v.name, v.sort_order
from (values
  ('academic', 'Academic', 10),
  ('workshop-training', 'Workshop & Training', 20),
  ('seminar-conference', 'Seminar & Conference', 30),
  ('technology-innovation', 'Technology & Innovation', 40),
  ('cultural', 'Cultural', 50),
  ('sports-recreation', 'Sports & Recreation', 60),
  ('community-outreach', 'Community & Outreach', 70),
  ('student-organization', 'Student Organization', 80),
  ('other', 'Other', 1000)
) as v(slug, name, sort_order)
where not exists (
  select 1 from public.event_categories c
  where c.slug = v.slug or lower(btrim(c.name)) = lower(v.name)
);
