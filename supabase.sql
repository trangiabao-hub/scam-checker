-- Run in Supabase SQL Editor

create table if not exists public.scam_cccd_reports (
  id uuid primary key default gen_random_uuid(),
  cccd text not null check (cccd ~ '^[0-9]{12}$'),
  reporter_name text not null default 'An danh',
  phone text not null default '',
  submitter_name text not null default '',
  submitter_phone text not null default '',
  description text not null check (char_length(description) > 0 and char_length(description) <= 2000),
  image_urls text[] not null default '{}',
  equipment_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

alter table public.scam_cccd_reports
add column if not exists equipment_items jsonb not null default '[]'::jsonb;

alter table public.scam_cccd_reports
add column if not exists submitter_name text not null default '';

alter table public.scam_cccd_reports
add column if not exists submitter_phone text not null default '';

alter table public.scam_cccd_reports enable row level security;

drop policy if exists "Public read reports" on public.scam_cccd_reports;
create policy "Public read reports"
on public.scam_cccd_reports
for select
to anon, authenticated
using (true);

drop policy if exists "Public create reports" on public.scam_cccd_reports;
create policy "Public create reports"
on public.scam_cccd_reports
for insert
to anon, authenticated
with check (
  cccd ~ '^[0-9]{12}$'
  and char_length(description) > 0
  and char_length(description) <= 2000
  and coalesce(array_length(image_urls, 1), 0) <= 6
  and jsonb_typeof(equipment_items) = 'array'
  and coalesce(jsonb_array_length(equipment_items), 0) <= 10
);

drop policy if exists "No update reports" on public.scam_cccd_reports;
create policy "No update reports"
on public.scam_cccd_reports
for update
to anon, authenticated
using (false);

drop policy if exists "No delete reports" on public.scam_cccd_reports;
create policy "No delete reports"
on public.scam_cccd_reports
for delete
to anon, authenticated
using (false);

insert into storage.buckets (id, name, public)
values ('report-evidences', 'report-evidences', true)
on conflict (id) do nothing;

drop policy if exists "Public read evidence images" on storage.objects;
create policy "Public read evidence images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'report-evidences');

drop policy if exists "Public upload evidence images" on storage.objects;
create policy "Public upload evidence images"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'report-evidences'
  and (storage.foldername(name))[1] = 'reports'
);
