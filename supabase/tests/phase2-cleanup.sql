-- DEVELOPMENT ONLY. Remove only the exact Phase 2 disposable identities. The check deletes
-- its own test photo through the Storage API; remove any leftover there, not with SQL.
begin;
delete from auth.users where id::text like 'e2000000-0000-4000-8000-00000000000_' and email like 'p2-%@eventhub.test';
commit;
