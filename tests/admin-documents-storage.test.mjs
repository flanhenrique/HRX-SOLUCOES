import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('document center uses private Supabase storage protected by AAL2', async () => {
  const [page, storageMigration, aal2Migration, css] = await Promise.all([
    read('src/quotes/AdminDocumentsPage.tsx'),
    read('supabase/migrations/20260818135457_hrx_document_center_storage.sql'),
    read('supabase/migrations/20260818140311_use_auth_jwt_for_document_aal2.sql'),
    read('src/quotes/admin-documents-page.css'),
  ])

  assert.match(page, /storage\.from\('hrx-documents'\)\.upload/)
  assert.match(page, /createSignedUrl\(document\.object_path, 60\)/)
  assert.match(page, /from\('hrx_documents'\)/)
  assert.match(page, /\+ Adicionar documento/)
  assert.match(page, /25 MB/)
  assert.match(page, /<VoltDocumentsWorkspace \/>/)
  assert.doesNotMatch(page, /createPortal|MutationObserver/)

  assert.match(storageMigration, /create table if not exists public\.hrx_documents/i)
  assert.match(storageMigration, /insert into storage\.buckets/i)
  assert.match(storageMigration, /'hrx-documents'/)
  assert.match(storageMigration, /file_size_limit[\s\S]*26214400/i)
  assert.match(storageMigration, /public\.admin_users/)

  assert.match(aal2Migration, /select auth\.uid\(\)/)
  assert.match(aal2Migration, /select coalesce\(auth\.jwt\(\) ->> 'aal', 'aal1'\)/)
  assert.match(aal2Migration, /'aal2'/)
  assert.match(aal2Migration, /bucket_id = 'hrx-documents'/)
  assert.match(css, /hrx-documents-file-list/)
})

test('VOLT library is embedded inside the HRX document center without a DOM bridge', async () => {
  const [page, volt, css] = await Promise.all([
    read('src/quotes/AdminDocumentsPage.tsx'),
    read('src/quotes/VoltDocumentsWorkspace.tsx'),
    read('src/quotes/volt-documents-workspace.css'),
  ])

  assert.match(page, /area\?\.key === 'internal' && folder === 'VOLT'/)
  assert.match(page, /<VoltDocumentsWorkspace \/>/)
  assert.match(volt, /VOLT · BIBLIOTECA CONTROLADA/)
  assert.match(volt, /createSignedUrl\(document\.object_path, 60\)/)
  assert.match(volt, /Importar biblioteca \(\.zip\)/)
  assert.doesNotMatch(volt, /createPortal|MutationObserver|document\.querySelector/)
  assert.match(css, /hrx-volt-folders/)
  assert.match(css, /hrx-volt-viewer/)
})
