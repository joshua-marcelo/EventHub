-- EventHub · Allow short event descriptions.
--
-- PENDING APPROVAL — not applied. Apply with the Supabase CLI (`supabase db push --linked`).
--
-- The events table required 20–5000 characters. Any meaningful (non-blank) description up to 5000
-- characters is now valid. Publishing still requires a description (events_check3 and publish_event
-- are unchanged), and save_event already stores blank input as NULL. Existing rows all satisfy the
-- new rule, so no data changes.
alter table public.events drop constraint events_description_check;
alter table public.events add constraint events_description_check
  check (description is null or char_length(btrim(description)) between 1 and 5000);
