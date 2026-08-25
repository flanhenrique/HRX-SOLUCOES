import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('financeiro pessoal usa armazenamento isolado e não altera o ledger empresarial', async () => {
  const migration = await read('supabase/migrations/20260824174500_personal_finance_isolation.sql')
  assert.match(migration, /create table if not exists public\.personal_financial_entries/)
  assert.match(migration, /owner_user_id uuid not null references auth\.users/)
  assert.match(migration, /enable row level security/)
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(migration, /auth\.jwt\(\)/)
  assert.match(migration, /'aal2'/)
  assert.doesNotMatch(migration, /alter table public\.financial_entries/)
})

test('Financeiro mantém visão HRX e adiciona visão Pessoal sem segundo shell', async () => {
  const [root, modules, scoped, personal] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/adminModules.ts'),
    read('src/quotes/AdminFinanceScopedPage.tsx'),
    read('src/quotes/AdminPersonalFinancePage.tsx'),
  ])
  const financeModule = modules.slice(modules.indexOf("id: 'finance'"), modules.indexOf("id: 'finance'") + 900)
  assert.match(financeModule, /component: lazy\(\(\) => import\('\.\/AdminFinanceScopedPage'\)\)/)
  assert.match(financeModule, /finance-receivable/)
  assert.match(financeModule, /finance-payable/)
  assert.match(root, /const ActiveView = route\.module\.component/)
  assert.match(root, /<AdminRouteProvider route=\{route\}>/)
  assert.match(scoped, /<AdminFinancePage \/>/)
  assert.match(scoped, /<AdminPersonalFinancePage \/>/)
  assert.match(scoped, /HRX Solutions/)
  assert.match(scoped, /Pessoal/)
  assert.doesNotMatch(scoped, /position:\s*fixed/)
  assert.match(personal, /personal_financial_entries/)
  assert.doesNotMatch(personal, /\.from\('financial_entries'\)/)
  assert.doesNotMatch(personal, /finance-admin/)
})

test('contas pessoais suportam criação, baixa, cancelamento e mobile', async () => {
  const [page, css] = await Promise.all([
    read('src/quotes/AdminPersonalFinancePage.tsx'),
    read('src/quotes/admin-finance-scope.css'),
  ])
  assert.match(page, /\+ Nova conta/)
  assert.match(page, /Registrar pagamento/)
  assert.match(page, /status: 'paid'/)
  assert.match(page, /status: 'cancelled'/)
  assert.match(page, /Separação financeira ativa/)
  assert.match(page, /não será usado nos indicadores empresariais/i)
  assert.match(css, /@media\(max-width:760px\)/)
  assert.match(css, /finance-scope-buttons/)
})
