import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('estorno preserva a baixa original e recalcula o ledger apenas com baixas ativas', async () => {
  const [baseMigration, migration] = await Promise.all([
    read('supabase/migrations/20260823224500_finance_receivables_phase1.sql'),
    read('supabase/migrations/20260824124000_finance_reversal_audit_topic2.sql'),
  ])
  assert.match(migration, /reversed_at timestamptz/)
  assert.match(migration, /reversed_by uuid references auth\.users/)
  assert.match(migration, /reversal_reason text/)
  assert.match(migration, /and reversed_at is null/)
  assert.match(baseMigration, /after insert or update or delete on public\.financial_settlements/)
  assert.doesNotMatch(migration, /delete from public\.financial_settlements/)
})

test('auditoria financeira é append-only e protegida por admin com AAL2', async () => {
  const migration = await read('supabase/migrations/20260824124000_finance_reversal_audit_topic2.sql')
  assert.match(migration, /create table if not exists public\.financial_audit_log/)
  assert.match(migration, /settlement_recorded/)
  assert.match(migration, /settlement_reversed/)
  assert.match(migration, /financial_audit_log_aal2/)
  assert.match(migration, /revoke insert, update, delete on public\.financial_audit_log from authenticated/)
})

test('backend só estorna a última baixa ativa, exige motivo e reabre proposta recebida', async () => {
  const backend = await read('supabase/functions/finance-admin/index.ts')
  assert.match(backend, /action: 'reverse_settlement'/)
  assert.match(backend, /reversal_reason_required/)
  assert.match(backend, /settlement_already_reversed/)
  assert.match(backend, /reversal_requires_latest/)
  assert.match(backend, /\.is\('reversed_at', null\)/)
  assert.match(backend, /commercial_status_invoiced_after_reversal/)
  assert.match(backend, /financial_settlement_reversed/)
})

test('métricas e cancelamento ignoram baixas já estornadas', async () => {
  const backend = await read('supabase/functions/finance-admin/index.ts')
  assert.match(backend, /select\('entry_id,amount,settled_at,reversed_at'\)/)
  assert.match(backend, /\.is\('reversed_at', null\)\n      \.gte\('settled_at'/)
  assert.match(backend, /eq\('entry_id', entryId\)\.is\('reversed_at', null\)/)
})

test('fechamento dos advisors indexa FKs de auditoria e evita reavaliação do JWT por linha', async () => {
  const migration = await read('supabase/migrations/20260824125500_finance_reversal_audit_advisor_fix.sql')
  assert.match(migration, /financial_audit_actor_user_idx/)
  assert.match(migration, /financial_settlements_reversed_by_idx/)
  assert.match(migration, /\(select auth\.jwt\(\)\) ->> 'aal'/)
})
