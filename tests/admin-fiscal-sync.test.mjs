import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('fiscal page allows manual IE and latest quote keeps the client synchronized', async () => {
  const [fiscal, migration, main] = await Promise.all([
    read('src/quotes/AdminFiscalPage.tsx'),
    read('supabase/migrations/20260817160000_sync_quote_clients_manual_state_registration.sql'),
    read('src/main.tsx'),
  ])

  assert.match(fiscal, /hrx_update_client_state_registration/)
  assert.match(fiscal, /Salvar cadastro estadual/)
  assert.match(fiscal, /Inscrição Estadual/)
  assert.match(fiscal, /Atualizar/)
  assert.match(fiscal, /onAdminNavigate/)
  assert.doesNotMatch(fiscal, /MutationObserver/)
  assert.doesNotMatch(fiscal, /createPortal/)
  assert.match(migration, /before insert or update on public\.quote_requests/i)
  assert.match(migration, /coalesce\(new\.created_at, now\(\)\) >= coalesce\(c\.last_quote_at/i)
  assert.match(main, /AdminFiscalPage/)
})
