-- DEVELOPMENT ONLY. Disposable identities for scripts/phase2-auth-check.mjs (DECISIONS D-022).
-- Known token hashes stand in for delivered emails. Always run phase2-cleanup.sql afterwards.
begin;
do $$ begin
  if exists(select 1 from auth.users where id::text like 'e2000000-0000-4000-8000-00000000000_') then
    raise exception 'Phase 2 fixtures already exist; run phase2-cleanup.sql first';
  end if;
end $$;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,confirmation_token,confirmation_sent_at,recovery_token,recovery_sent_at,email_change_token_new,email_change,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', 'p2-' || label || '@eventhub.test',
  extensions.crypt('Phase2pass1', extensions.gen_salt('bf')), case when confirmed then now() end,
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('first_name', 'P2', 'last_name', label), false,
  coalesce(confirm_token, ''), case when confirm_token is not null then sent_at end,
  coalesce(recover_token, ''), case when recover_token is not null then sent_at end, '', '', now(), now()
from (values
  ('e2000000-0000-4000-8000-000000000001'::uuid, 'confirmed', true, null, null, now()),
  ('e2000000-0000-4000-8000-000000000002'::uuid, 'unconfirmed', false, 'p2confirmtoken0000000000000000000000000000000000000000002', null, now()),
  ('e2000000-0000-4000-8000-000000000003'::uuid, 'recover', true, null, 'p2recovertoken000000000000000000000000000000000000000003', now()),
  ('e2000000-0000-4000-8000-000000000004'::uuid, 'expired', false, 'p2expiredtoken000000000000000000000000000000000000000004', null, now() - interval '2 hours'),
  ('e2000000-0000-4000-8000-000000000005'::uuid, 'evilnext', false, 'p2evilnexttoken00000000000000000000000000000000000000005', null, now())
) as f(id, label, confirmed, confirm_token, recover_token, sent_at);
insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
select extensions.gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', email_confirmed_at is not null), 'email', now(), now()
from auth.users where id::text like 'e2000000-0000-4000-8000-00000000000_';
insert into auth.one_time_tokens(id,user_id,token_type,token_hash,relates_to,created_at,updated_at)
select extensions.gen_random_uuid(), id, 'confirmation_token', confirmation_token, email, confirmation_sent_at, confirmation_sent_at
from auth.users where id::text like 'e2000000-0000-4000-8000-00000000000_' and confirmation_token <> '';
insert into auth.one_time_tokens(id,user_id,token_type,token_hash,relates_to,created_at,updated_at)
select extensions.gen_random_uuid(), id, 'recovery_token', recovery_token, email, recovery_sent_at, recovery_sent_at
from auth.users where id::text like 'e2000000-0000-4000-8000-00000000000_' and recovery_token <> '';
commit;
