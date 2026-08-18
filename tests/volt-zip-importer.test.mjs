import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('VOLT ZIP importer deduplicates, versions and uploads into private HRX storage', async () => {
  const [importer, main, migration] = await Promise.all([
    read('src/quotes/VoltZipImporter.tsx'),
    read('src/main.tsx'),
    read('supabase/migrations/20260818153107_add_document_checksum_uniqueness.sql'),
  ])

  assert.match(main, /<VoltZipImporter \/>/)
  assert.match(importer, /DecompressionStream\('deflate-raw'\)/)
  assert.match(importer, /crypto\.subtle\.digest\('SHA-256'/)
  assert.match(importer, /checksum_sha256/)
  assert.match(importer, /storage\.from\('hrx-documents'\)\.upload/)
  assert.match(importer, /folder: 'VOLT'/)
  assert.match(importer, /knownChecksums\.has\(checksum\) \|\| batchChecksums\.has\(checksum\)/)
  assert.match(importer, /code === 'PRD-000' && version === 1 \? 'superseded' : 'active'/)
  assert.match(importer, /Product-Requirements-Master\\s\*\\\(1\\\)\\\.pdf/)
  assert.match(importer, /50 \* 1024 \* 1024/)
  assert.match(importer, /25 \* 1024 \* 1024/)
  assert.match(migration, /unique index if not exists hrx_documents_checksum_unique_idx/i)
})
