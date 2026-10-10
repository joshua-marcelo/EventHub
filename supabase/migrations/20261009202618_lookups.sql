-- EventHub · Phase 1 · Lookup tables (SYSTEM_SPEC §12.2).
-- Rows are managed by migrations only. Official lists are pending from the client
-- (SYSTEM_SPEC §20 C3, docs/DECISIONS.md D-001), so no rows are seeded here.

create table public.colleges (
  id smallint generated always as identity primary key,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint colleges_code_key unique (code),
  constraint colleges_name_key unique (name),
  constraint colleges_code_format check (code ~ '^[A-Z0-9-]{2,15}$'),
  constraint colleges_name_length check (char_length(name) between 3 and 150)
);

create table public.event_categories (
  id smallint generated always as identity primary key,
  slug text not null,
  name text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint event_categories_slug_key unique (slug),
  constraint event_categories_name_key unique (name),
  constraint event_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint event_categories_name_length check (char_length(name) between 2 and 60)
);

alter table public.colleges enable row level security;
alter table public.event_categories enable row level security;

revoke all on table public.colleges, public.event_categories from anon, authenticated;
grant select on table public.colleges, public.event_categories to anon, authenticated;

create policy "Lookup: colleges are readable by everyone"
  on public.colleges for select
  to anon, authenticated
  using (true);

create policy "Lookup: event categories are readable by everyone"
  on public.event_categories for select
  to anon, authenticated
  using (true);
