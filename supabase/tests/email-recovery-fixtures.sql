-- Development-only disposable identities for scripts/email-recovery-check.mjs.
-- Refuse to overwrite anything. Never apply these fixtures to production.
begin;
do $$ begin
  if exists(select 1 from auth.users where id in ('af000000-0000-4000-8000-000000000001', 'af000000-0000-4000-8000-000000000002', 'af000000-0000-4000-8000-000000000003')) then
    raise exception 'Recovery fixtures already exist; inspect before proceeding';
  end if;
end $$;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,confirmation_token,recovery_token,recovery_sent_at,email_change_token_new,email_change,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
  'email-recovery-' || label || '@eventhub.test',
  extensions.crypt(encode(extensions.gen_random_bytes(32),'hex'),extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"first_name":"Recovery","last_name":"Test"}'::jsonb, false, '',
  encode(extensions.digest(id::text || ':email-recovery-integration','sha256'),'hex'), sent_at, '', '', now(), now()
from (values ('af000000-0000-4000-8000-000000000001'::uuid,'fresh',now()), ('af000000-0000-4000-8000-000000000002'::uuid,'expired',now()-interval '2 hours'), ('af000000-0000-4000-8000-000000000003'::uuid,'pkce',now())) as fixtures(id,label,sent_at);
insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
select extensions.gen_random_uuid(), id, id::text, jsonb_build_object('sub',id::text,'email',email,'email_verified',true), 'email', now(), now()
from auth.users where id in ('af000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000002','af000000-0000-4000-8000-000000000003');
insert into auth.one_time_tokens(id,user_id,token_type,token_hash,relates_to,created_at,updated_at,expires_at)
select extensions.gen_random_uuid(),id,'recovery_token',recovery_token,email,recovery_sent_at,recovery_sent_at,recovery_sent_at+interval '1 hour'
from auth.users where id in ('af000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000002');
-- An issued PKCE code with its challenge, to reproduce the original callback failure.
insert into auth.flow_state(id,user_id,auth_code,code_challenge_method,code_challenge,provider_type,authentication_method,provider_access_token,provider_refresh_token,created_at,updated_at,auth_code_issued_at)
select extensions.gen_random_uuid(),id,id::text,'s256',
  rtrim(translate(encode(extensions.digest(encode(extensions.digest(id::text || ':pkce-verifier','sha256'),'hex'),'sha256'),'base64'),'+/','-_'),'='),
  'recovery','recovery','','',now(),now(),now()
from auth.users where id='af000000-0000-4000-8000-000000000003';
commit;
