create table if not exists public.hrx_documents (
  id uuid primary key default gen_random_uuid(),
  object_path text not null unique,
  area_key text not null,
  folder text not null,
  client_name text,
  document_type text,
  title text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('active','superseded','archived')),
  access_class text not null default 'internal' check (access_class in ('internal','restricted','confidential')),
  effective_date date,
  expires_at date,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hrx_documents_area_folder_idx on public.hrx_documents(area_key, folder, created_at desc);
create index if not exists hrx_documents_client_idx on public.hrx_documents(client_name) where client_name is not null;
create index if not exists hrx_documents_expiry_idx on public.hrx_documents(expires_at) where expires_at is not null and status = 'active';

alter table public.hrx_documents enable row level security;

drop policy if exists hrx_documents_admin_aal2_select on public.hrx_documents;
create policy hrx_documents_admin_aal2_select on public.hrx_documents
for select to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
);

drop policy if exists hrx_documents_admin_aal2_insert on public.hrx_documents;
create policy hrx_documents_admin_aal2_insert on public.hrx_documents
for insert to authenticated
with check (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
);

drop policy if exists hrx_documents_admin_aal2_update on public.hrx_documents;
create policy hrx_documents_admin_aal2_update on public.hrx_documents
for update to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
)
with check (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
);

drop policy if exists hrx_documents_admin_aal2_delete on public.hrx_documents;
create policy hrx_documents_admin_aal2_delete on public.hrx_documents
for delete to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hrx-documents',
  'hrx-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hrx_documents_storage_select on storage.objects;
create policy hrx_documents_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
);

drop policy if exists hrx_documents_storage_insert on storage.objects;
create policy hrx_documents_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
);

drop policy if exists hrx_documents_storage_update on storage.objects;
create policy hrx_documents_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
)
with check (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
);

drop policy if exists hrx_documents_storage_delete on storage.objects;
create policy hrx_documents_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  and coalesce((coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'aal'), 'aal1') = 'aal2'
);
