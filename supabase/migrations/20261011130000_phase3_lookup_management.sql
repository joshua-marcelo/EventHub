-- Phase 3: audited, admin-only lookup mutations. Existing column grants/RLS remain.
-- Restrictive write policies also refuse anonymous claims carrying an admin's subject.
create policy "Lookup: permanent college inserts" on public.colleges as restrictive for insert to authenticated with check ((select private.is_permanent_user()));
create policy "Lookup: permanent college updates" on public.colleges as restrictive for update to authenticated using ((select private.is_permanent_user())) with check ((select private.is_permanent_user()));
create policy "Lookup: permanent program inserts" on public.programs as restrictive for insert to authenticated with check ((select private.is_permanent_user()));
create policy "Lookup: permanent program updates" on public.programs as restrictive for update to authenticated using ((select private.is_permanent_user())) with check ((select private.is_permanent_user()));
create policy "Lookup: permanent category inserts" on public.event_categories as restrictive for insert to authenticated with check ((select private.is_permanent_user()));
create policy "Lookup: permanent category updates" on public.event_categories as restrictive for update to authenticated using ((select private.is_permanent_user())) with check ((select private.is_permanent_user()));

create function private.audit_lookup_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then return new; end if;
  perform private.log_audit(
    case when tg_op = 'INSERT' then 'lookup.created' else 'lookup.updated' end,
    tg_table_name, null,
    jsonb_build_object('lookup_id', new.id, 'before', case when tg_op = 'UPDATE' then to_jsonb(old) else null end, 'after', to_jsonb(new))
  );
  return new;
end;
$$;
revoke all on function private.audit_lookup_change() from public, anon, authenticated;
create trigger colleges_audit after insert or update on public.colleges for each row execute function private.audit_lookup_change();
create trigger programs_audit after insert or update on public.programs for each row execute function private.audit_lookup_change();
create trigger event_categories_audit after insert or update on public.event_categories for each row execute function private.audit_lookup_change();

-- No dynamic SQL, deletion or role mutation. Updates always carry the full editable fields.
create function public.save_lookup(p_kind text, p_id smallint, p_values jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_code text;
  v_slug text;
  v_active boolean;
  v_college smallint;
  v_order smallint;
begin
  if not (select private.is_permanent_user()) then return 'not_permitted'; end if;
  if not (select private.is_admin()) then return 'not_permitted'; end if;
  if p_kind is null or p_kind not in ('colleges', 'programs', 'event_categories') then return 'invalid_kind'; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'object' then return 'invalid_input'; end if;
  if jsonb_typeof(p_values -> 'name') is distinct from 'string'
     or jsonb_typeof(p_values -> 'is_active') is distinct from 'boolean' then return 'invalid_input'; end if;
  v_name := btrim(p_values ->> 'name');
  v_active := (p_values ->> 'is_active')::boolean;
  if p_kind = 'colleges' then
    v_code := btrim(p_values ->> 'code');
    if char_length(v_name) not between 3 and 150 or v_code is null or v_code !~ '^[A-Z0-9-]{2,15}$' then return 'invalid_input'; end if;
    if p_id is null then
      insert into public.colleges (code, name, is_active) values (v_code, v_name, v_active);
    else
      update public.colleges set code = v_code, name = v_name, is_active = v_active where id = p_id;
      if not found then return 'not_found'; end if;
    end if;
  elsif p_kind = 'programs' then
    v_college := (p_values ->> 'college_id')::smallint;
    if char_length(v_name) not between 2 and 120 or v_college is null then return 'invalid_input'; end if;
    if p_id is null then
      if not exists (select 1 from public.colleges where id = v_college and is_active) then return 'inactive_college'; end if;
      insert into public.programs (college_id, name, is_active) values (v_college, v_name, v_active);
    else
      -- College is immutable, including for an admin using this definer RPC.
      perform 1 from public.programs where id = p_id for update;
      if not found then return 'not_found'; end if;
      if not exists (select 1 from public.programs where id = p_id and college_id = v_college) then return 'college_locked'; end if;
      update public.programs set name = v_name, is_active = v_active where id = p_id;
    end if;
  else
    v_slug := btrim(p_values ->> 'slug');
    v_order := (p_values ->> 'sort_order')::smallint;
    if char_length(v_name) not between 2 and 60 or v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or v_order is null then return 'invalid_input'; end if;
    if p_id is null then
      insert into public.event_categories (slug, name, sort_order, is_active) values (v_slug, v_name, v_order, v_active);
    else
      update public.event_categories set slug = v_slug, name = v_name, sort_order = v_order, is_active = v_active where id = p_id;
      if not found then return 'not_found'; end if;
    end if;
  end if;
  return 'ok';
exception
  when unique_violation then return 'duplicate';
  when foreign_key_violation then return 'invalid_college';
  when check_violation or invalid_text_representation or numeric_value_out_of_range then return 'invalid_input';
end;
$$;
revoke all on function public.save_lookup(text, smallint, jsonb) from public, anon;
grant execute on function public.save_lookup(text, smallint, jsonb) to authenticated;
