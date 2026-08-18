import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('VOLT workspace deduplicates, versions and uploads ZIP documents into private HRX storage', async () => {
  const [workspace, documents, main, migration] = await Promise.all([
    read('src/quotes/VoltDocumentsWorkspace.tsx'),
    read('src/quotes/AdminDocumentsPage.tsx'),
    read('src/main.tsx'),
    read('supabase/migrations/20260818153107_add_document_checksum_uniqueness.sql'),
  ])

  assert.match(documents, /<VoltDocumentsWorkspace \/>/)
  assert.doesNotMatch(main, /VoltZipImporter|VoltDocumentFolders/)
  assert.match(workspace, /DecompressionStream\('deflate-raw'\)/)
  assert.match(workspace, /crypto\.subtle\.digest\('SHA-256'/)
  assert.match(workspace, /checksum_sha256/)
  assert.match(workspace, /storage\.from\('hrx-documents'\)\.upload/)
  assert.match(workspace, /folder: 'VOLT'/)
  assert.match(workspace, /known\.has\(checksum\) \|\| batch\.has\(checksum\)/)
  assert.match(workspace, /code === 'PRD-000' && version === 1 \? 'superseded' : 'active'/)
  assert.match(workspace, /Product-Requirements-Master\\s\*\\\(1\\\)\\\.pdf/)
  assert.match(workspace, /50 \* 1024 \* 1024/)
  assert.match(workspace, /25 \* 1024 \* 1024/)
  assert.doesNotMatch(workspace, /createPortal|MutationObserver/)
  assert.match(migration, /unique index if not exists hrx_documents_checksum_unique_idx/i)
})
