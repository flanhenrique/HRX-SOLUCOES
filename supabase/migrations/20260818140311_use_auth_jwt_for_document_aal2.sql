drop policy if exists hrx_documents_admin_aal2_select on public.hrx_documents;
create policy hrx_documents_admin_aal2_select on public.hrx_documents
for select to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
);

drop policy if exists hrx_documents_admin_aal2_insert on public.hrx_documents;
create policy hrx_documents_admin_aal2_insert on public.hrx_documents
for insert to authenticated
with check (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
);

drop policy if exists hrx_documents_admin_aal2_update on public.hrx_documents;
create policy hrx_documents_admin_aal2_update on public.hrx_documents
for update to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
)
with check (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
);

drop policy if exists hrx_documents_admin_aal2_delete on public.hrx_documents;
create policy hrx_documents_admin_aal2_delete on public.hrx_documents
for delete to authenticated
using (
  exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
);

drop policy if exists hrx_documents_storage_select on storage.objects;
create policy hrx_documents_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
);

drop policy if exists hrx_documents_storage_insert on storage.objects;
create policy hrx_documents_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
);

drop policy if exists hrx_documents_storage_update on storage.objects;
create policy hrx_documents_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
)
with check (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
);

drop policy if exists hrx_documents_storage_delete on storage.objects;
create policy hrx_documents_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'hrx-documents'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
  and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
);
