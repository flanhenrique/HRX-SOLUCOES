import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('cálculo comercial usa centavos, imposto e ajuste de valor final', async () => {
  const [math, editor] = await Promise.all([read('src/quotes/quoteMath.ts'), read('src/quotes/AdminQuotes.tsx')])
  assert.match(math, /preDiscountCents/)
  assert.match(math, /taxCents/)
  assert.match(math, /customAdjustmentAmount/)
  assert.match(math, /buildInstallmentSchedule/)
  assert.match(editor, /RESUMO FINANCEIRO/)
  assert.match(editor, /Imposto estimado/)
  assert.match(editor, /Definir valor final/)
  assert.match(editor, /getAuthenticatorAssuranceLevel/)
})

test('salvamento unifica itens, cálculos, parcelas e histórico no backend', async () => {
  const [editor, backend] = await Promise.all([read('src/quotes/AdminQuotes.tsx'), read('supabase/functions/quote-admin/index.ts')])
  assert.match(editor, /action: 'save_quote'/)
  assert.match(backend, /action: 'save_quote'/)
  assert.match(backend, /resolveItems/)
  assert.match(backend, /quote_payment_installments/)
  assert.match(backend, /draft_saved/)
  assert.match(backend, /custom_final_amount_confirmed/)
})

test('proposta versionada possui PDF, Central e ações explícitas de envio', async () => {
  const [editor, pdf, backend] = await Promise.all([read('src/quotes/AdminQuotes.tsx'), read('src/quotes/proposalPdf.ts'), read('supabase/functions/quote-admin/index.ts')])
  assert.match(pdf, /RASCUNHO/)
  assert.match(pdf, /PROPOSTA COMERCIAL/)
  assert.match(editor, /navigator\.share/)
  assert.match(editor, /wa\.me/)
  assert.match(editor, /mailto:/)
  assert.match(editor, /navigator\.clipboard\.writeText/)
  assert.match(editor, /createSignedUrl/)
  assert.match(backend, /quote_versions/)
  assert.match(backend, /hrx_documents/)
  assert.match(backend, /Propostas Comerciais/)
})

test('mobile separa lista e editor e usa fluxo comercial por etapas', async () => {
  const [editor, css] = await Promise.all([read('src/quotes/AdminQuotes.tsx'), read('src/quotes/quote-commercial.css')])
  assert.match(editor, /is-mobile-detail-open/)
  assert.match(editor, /quote-back/)
  assert.match(editor, /className="admin-mobile-nav"/)
  for (const label of ['Cliente', 'Itens', 'Valores', 'Pagamento', 'Revisão', 'Envio']) assert.match(editor, new RegExp(label))
  assert.match(css, /is-mobile-detail-open \.quote-queue/)
  assert.match(css, /is-mobile-detail-open \.quote-detail/)
  assert.match(css, /env\(safe-area-inset-bottom\)/)
})

test('ação de finalizar permanece visível no PWA e recebe cache bust', async () => {
  const [brandFix, index] = await Promise.all([read('public/hrx-brand-fix.css'), read('index.html')])
  assert.match(brandFix, /quote-review-card > footer/)
  assert.match(brandFix, /position: sticky !important/)
  assert.match(brandFix, /quote-review-card > footer \.quote-primary/)
  assert.match(brandFix, /min-height: 48px/)
  assert.match(index, /hrx-brand-fix\.css\?v=5/)
})
