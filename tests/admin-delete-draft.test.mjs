import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('suspensions exposes confirmed deletion only for unversioned drafts', async () => {
  const page = await read('src/quotes/AdminSuspensionsPage.tsx')

  assert.match(page, /commercial_status,current_version/)
  assert.match(page, /commercial_status === 'draft'/)
  assert.match(page, /current_version \?\? 0/)
  assert.match(page, /hrx_delete_draft_quote/)
  assert.match(page, /setDeleteTarget\(quote\)/)
  assert.match(page, />Excluir</)
  assert.match(page, /EXCLUSÃO DEFINITIVA/)
  assert.match(page, /Excluir definitivamente/)
  assert.match(page, /não exclui o cadastro do cliente/)
})

test('draft deletion RPC requires AAL2 admin and refuses official or financial quotes', async () => {
  const migration = await read('supabase/migrations/20260823213838_allow_admin_delete_unversioned_draft_quotes.sql')

  assert.match(migration, /security definer/i)
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(migration, /auth\.jwt\(\) ->> 'aal'/)
  assert.match(migration, /'aal2'/)
  assert.match(migration, /admin_users/)
  assert.match(migration, /commercial_status <> 'draft'/)
  assert.match(migration, /current_version/)
  assert.match(migration, /quote_versions/)
  assert.match(migration, /hrx_documents/)
  assert.match(migration, /financial_entries/)
  assert.match(migration, /revoke all on function public\.hrx_delete_draft_quote\(uuid\) from public/i)
  assert.match(migration, /grant execute on function public\.hrx_delete_draft_quote\(uuid\) to authenticated/i)
})
