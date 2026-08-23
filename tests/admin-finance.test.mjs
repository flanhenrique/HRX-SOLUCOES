import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('financeiro reutiliza ledger oficial e vincula proposta, parcela e versão', async () => {
  const [migration, backend] = await Promise.all([
    read('supabase/migrations/20260823224500_finance_receivables_phase1.sql'),
    read('supabase/functions/finance-admin/index.ts'),
  ])
  assert.match(migration, /alter table public\.financial_entries/)
  assert.match(migration, /quote_version_id/)
  assert.match(migration, /quote_installment_id/)
  assert.match(migration, /financial_settlements/)
  assert.match(migration, /tax_reserve_amount/)
  assert.match(backend, /create_receivables/)
  assert.match(backend, /record_settlement/)
  assert.match(backend, /financial_receivables_created/)
  assert.match(backend, /commercial_status_received/)
})

test('faturamento usa a versão aprovada e o cronograma como fonte de verdade', async () => {
  const backend = await read('supabase/functions/finance-admin/index.ts')
  assert.match(backend, /approvedSnapshotAmountCents/)
  assert.match(backend, /proposal\.custom_final_amount/)
  assert.match(backend, /approved_payment_schedule_mismatch/)
  assert.match(backend, /amountSource: 'approved_version_and_payment_schedule'/)
  assert.match(backend, /taxReserveTotal = Math\.round\(scheduleTotal \* taxPercent \/ 100\)/)
  assert.doesNotMatch(backend, /allocateTax\(Number\(draft\.tax_amount/)
})

test('baixa exige conta configurável e comprovante permanece opcional na Central', async () => {
  const [page, backend] = await Promise.all([
    read('src/quotes/AdminFinancePage.tsx'),
    read('supabase/functions/finance-admin/index.ts'),
  ])
  assert.match(page, /Configurar contas de recebimento/)
  assert.match(page, /Comprovante é recomendado|comprovante é recomendado/i)
  assert.match(page, /hrx-documents/)
  assert.match(page, /SHA-256/)
  assert.match(backend, /Comprovante de Recebimento/)
  assert.match(backend, /account_required/)
  assert.match(backend, /receipt_document_id/)
})

test('navegação expõe Financeiro sem substituir as cinco áreas primárias do PWA', async () => {
  const [root, navigation] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/adminNavigation.ts'),
  ])
  assert.match(root, /AdminFinancePage/)
  assert.match(root, /label: 'Financeiro'/)
  assert.match(root, /destination === 'finance'/)
  assert.match(navigation, /#admin\/financeiro/)
  assert.match(root, /new Set<AdminDestination>\(\['executive', 'quotes', 'panels', 'documents', 'settings'\]\)/)
})

test('financeiro tem tratamento mobile e rota direta no deploy', async () => {
  const [css, workflow] = await Promise.all([
    read('src/quotes/admin-finance.css'),
    read('.github/workflows/deploy-pages.yml'),
  ])
  assert.match(css, /@media\(max-width:760px\)/)
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(workflow, /dist\/admin\/financeiro/)
  assert.match(workflow, /for route in \('orcamentos', 'financeiro'\)/)
})
