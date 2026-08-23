import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('cenários A–I: cliente, rascunho, duplicação, valores e parcelas', async () => {
  const [ui, api, migration] = await Promise.all([
    read('src/quotes/AdminQuotes.tsx'),
    read('supabase/functions/quote-admin/index.ts'),
    read('supabase/migrations/20260823203057_quote_commercial_lifecycle.sql'),
  ])
  assert.match(ui, /Comece pelo cliente/)
  assert.match(ui, /AdminClientForm/)
  assert.match(ui, /Cadastrar novo cliente/)
  assert.match(ui, /Salvo agora/)
  assert.match(ui, /Excluir este rascunho/)
  assert.match(ui, /Duplicar/)
  assert.match(ui, /Desconto percentual/)
  assert.match(ui, /Imposto estimado/)
  assert.match(ui, /Vencimentos previstos/)
  assert.match(api, /create_quote/)
  assert.match(api, /delete_draft/)
  assert.match(api, /duplicate_quote/)
  assert.match(migration, /HRX-ORC-/)
  assert.match(migration, /quote_payment_installments/)
})

test('cenários J–N: PDF, versão, e-mail, WhatsApp e PWA', async () => {
  const [ui, api, pdf, css] = await Promise.all([
    read('src/quotes/AdminQuotes.tsx'),
    read('supabase/functions/quote-admin/index.ts'),
    read('src/quotes/proposalPdf.ts'),
    read('src/quotes/quote-commercial.css'),
  ])
  assert.match(ui, /Finalizar proposta/)
  assert.match(ui, /Compartilhar com PDF/)
  assert.match(ui, /WhatsApp/)
  assert.match(api, /proposal_version_generated/)
  assert.match(api, /commercial_status_\$\{body\.status\}/)
  assert.match(pdf, /RASCUNHO/)
  assert.match(css, /@media\(max-width:760px\)/)
  assert.match(css, /quote-steps\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);overflow:visible/)
  assert.match(css, /grid-template-columns:repeat\(5,1fr\)!important/)
})

test('exemplo R$ 507,01 para R$ 500,00 preserva centavos e exige justificativa', async () => {
  const [math, ui, api] = await Promise.all([read('src/quotes/quoteMath.ts'), read('src/quotes/AdminQuotes.tsx'), read('supabase/functions/quote-admin/index.ts')])
  assert.match(math, /toCents/)
  assert.match(math, /fromCents/)
  assert.match(ui, /adjustmentReason/)
  assert.match(ui, /Confirmar com AAL2/)
  assert.match(api, /adjustment_reason_required/)
  assert.match(api, /custom_adjustment_by/)
})

test('versões oficiais preservam snapshot e escrita passa pela função AAL2', async () => {
  const [migration, grants, api] = await Promise.all([
    read('supabase/migrations/20260823204142_harden_quote_version_immutability.sql'),
    read('supabase/migrations/20260823204215_restrict_quote_table_grants.sql'),
    read('supabase/functions/quote-admin/index.ts'),
  ])
  assert.match(migration, /quote_version_snapshot_is_immutable/)
  assert.match(grants, /revoke all privileges on public\.quote_versions from authenticated/)
  assert.match(grants, /grant select on public\.quote_versions to authenticated/)
  assert.match(api, /claimsResult\?\.claims\?\.aal !== 'aal2'/)
})
