import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('fiscal page allows manual IE and latest quote keeps the client synchronized', async () => {
  const [fiscal, migration, adminApp, root, modules, authRouter] = await Promise.all([
    read('src/quotes/AdminFiscalPage.tsx'),
    read('supabase/migrations/20260817160000_sync_quote_clients_manual_state_registration.sql'),
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/adminModules.ts'),
    read('src/quotes/AdminAuthRouter.tsx'),
  ])

  assert.match(fiscal, /hrx_update_client_state_registration/)
  assert.match(fiscal, /Salvar cadastro estadual/)
  assert.match(fiscal, /Inscrição Estadual/)
  assert.match(fiscal, /Atualizar/)
  assert.doesNotMatch(fiscal, /onAdminNavigate|onAdminRouteChange|window\.location\.hash/)
  assert.doesNotMatch(fiscal, /MutationObserver/)
  assert.doesNotMatch(fiscal, /createPortal/)
  assert.match(migration, /before insert or update on public\.quote_requests/i)
  assert.match(migration, /coalesce\(new\.created_at, now\(\)\) >= coalesce\(c\.last_quote_at/i)
  assert.match(adminApp, /<AdminUnifiedRoot \/>/)
  assert.doesNotMatch(adminApp, /<AdminFiscalPage \/>/)
  assert.match(root, /const ActiveView = route\.module\.component/)
  assert.match(root, /<AdminRouteProvider route=\{route\}>/)
  const fiscalModule = modules.slice(modules.indexOf("id: 'fiscal'"), modules.indexOf("id: 'fiscal'") + 600)
  assert.match(fiscalModule, /path: '\/admin\/fiscal'/)
  assert.match(fiscalModule, /component: lazy\(\(\) => import\('\.\/AdminFiscalPage'\)\)/)
  assert.match(authRouter, /<AdminMfaGate session=\{session\}><AdminApp \/><\/AdminMfaGate>/)
})
