-- Public landing content is limited to upcoming, published, public events.
create function public.get_upcoming_public_events()
returns table(id uuid,title text,category_name text,starts_at timestamptz,venue text,banner_path text,registration_state text)
language sql stable security definer set search_path = '' as $$
  select e.id,e.title,c.name,e.starts_at,e.venue,e.banner_path,
    case when now() < e.registration_opens_at then 'Opening soon'
         when now() >= e.registration_closes_at then 'Registration closed'
         when e.capacity is not null and (select count(*) from public.event_registrations r where r.event_id = e.id and r.status = 'approved') >= e.capacity then 'Fully booked'
         else 'Registration open' end
  from public.events e left join public.event_categories c on c.id = e.category_id
  where e.visibility = 'public' and e.status = 'published' and e.starts_at > now()
  order by e.starts_at,e.id limit 6;
$$;
revoke all on function public.get_upcoming_public_events() from public;
grant execute on function public.get_upcoming_public_events() to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('event-banners','event-banners',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy "Banners: active event owner upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'event-banners' and (select private.is_permanent_user()) and (select private.is_active_organizer())
  and exists(select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and e.organizer_id = (select auth.uid()) and e.status in ('draft','published'))
);
create policy "Banners: owner read" on storage.objects for select to authenticated using (bucket_id = 'event-banners' and (select private.is_permanent_user()) and exists(select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and e.organizer_id = (select auth.uid())));
create policy "Banners: active owner delete" on storage.objects for delete to authenticated using (bucket_id = 'event-banners' and (select private.is_permanent_user()) and (select private.is_active_organizer()) and exists(select 1 from public.events e where e.id::text = (storage.foldername(name))[1] and e.organizer_id = (select auth.uid()) and e.status in ('draft','published')));

create function public.set_event_banner(p_event_id uuid,p_path text) returns text language plpgsql security definer set search_path = '' as $$
declare v_event public.events;
begin
  if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted'; end if;
  select * into v_event from public.events where id = p_event_id and organizer_id = auth.uid() for update;
  if not found or v_event.status not in ('draft','published') then return 'not_permitted'; end if;
  if p_path is not null and not exists(select 1 from storage.objects where bucket_id = 'event-banners' and name = p_path and (storage.foldername(name))[1] = p_event_id::text) then return 'invalid_path'; end if;
  update public.events set banner_path = p_path where id = p_event_id;
  perform private.log_audit('event.banner_updated','events',p_event_id); return 'ok';
end; $$;
revoke all on function public.set_event_banner(uuid,text) from public,anon;
grant execute on function public.set_event_banner(uuid,text) to authenticated;
