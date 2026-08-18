import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('document center uses private Supabase storage protected by AAL2', async () => {
  const [hub, storageMigration, aal2Migration, css] = await Promise.all([
    read('src/quotes/AdminDocumentsHub.tsx'),
    read('supabase/migrations/20260818135457_hrx_document_center_storage.sql'),
    read('supabase/migrations/20260818140311_use_auth_jwt_for_document_aal2.sql'),
    read('src/quotes/admin-documents-storage.css'),
  ])

  assert.match(hub, /storage\.from\('hrx-documents'\)\.upload/)
  assert.match(hub, /createSignedUrl\(document\.object_path, 60\)/)
  assert.match(hub, /from\('hrx_documents'\)/)
  assert.match(hub, /\+ Adicionar documento/)
  assert.match(hub, /25 MB/)
  assert.doesNotMatch(hub, /github\.com/i)
  assert.doesNotMatch(hub, /repositório de código/i)

  assert.match(storageMigration, /create table if not exists public\.hrx_documents/i)
  assert.match(storageMigration, /insert into storage\.buckets/i)
  assert.match(storageMigration, /'hrx-documents'/)
  assert.match(storageMigration, /file_size_limit[\s\S]*26214400/i)
  assert.match(storageMigration, /public\.admin_users/)

  assert.match(aal2Migration, /select auth\.uid\(\)/)
  assert.match(aal2Migration, /select coalesce\(auth\.jwt\(\) ->> 'aal', 'aal1'\)/)
  assert.match(aal2Migration, /'aal2'/)
  assert.match(aal2Migration, /bucket_id = 'hrx-documents'/)
  assert.match(css, /hrx-document-file-list/)
})

test('VOLT library stays inside the HRX document center', async () => {
  const [hub, css] = await Promise.all([
    read('src/quotes/AdminDocumentsHub.tsx'),
    read('src/quotes/admin-documents-storage.css'),
  ])

  assert.match(hub, /VOLT · BIBLIOTECA DOCUMENTAL/)
  assert.match(hub, /raw\.githubusercontent\.com\/flanhenrique\/Volt-consumo\/main/)
  assert.match(hub, /openVoltDocument/)
  assert.match(hub, /hrx-document-viewer-overlay/)
  assert.match(hub, /Leitura interna · sem redirecionamento externo/)
  assert.doesNotMatch(hub, /window\.open\(/)
  assert.match(css, /hrx-volt-library-list/)
  assert.match(css, /hrx-document-viewer-body/)
})
