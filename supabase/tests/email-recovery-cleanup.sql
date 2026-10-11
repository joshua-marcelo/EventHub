-- Exact disposable identities only; preserve every real account.
delete from auth.flow_state where user_id in ('af000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000002','af000000-0000-4000-8000-000000000003');
delete from auth.users where
  (id='af000000-0000-4000-8000-000000000001' and email='email-recovery-fresh@eventhub.test') or
  (id='af000000-0000-4000-8000-000000000002' and email='email-recovery-expired@eventhub.test') or
  (id='af000000-0000-4000-8000-000000000003' and email='email-recovery-pkce@eventhub.test');
