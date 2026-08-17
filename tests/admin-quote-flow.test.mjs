import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('catálogo calcula a prévia e apresenta retenções em tempo real', async () => {
  const [math, editor] = await Promise.all([
    read('src/quotes/quoteMath.ts'),
    read('src/quotes/AdminQuotes.tsx'),
  ])

  assert.match(math, /baseAmount \* complexity \* urgency/)
  assert.match(math, /discountAmount/)
  assert.match(math, /retentionGrossUpSuggestion/)
  assert.match(math, /retentionBreakdown/)
  assert.match(editor, /subtotal atual/)
  assert.match(editor, /Total das retenções/)
  assert.match(editor, /RESUMO FINANCEIRO/)
  assert.match(editor, /Visão geral/)
  assert.match(editor, /Composição/)
  assert.match(editor, /Financeiro/)
  assert.match(editor, /Fiscal/)
  assert.match(editor, /Envio/)
})

test('salvamento unifica catálogo e cálculo no backend', async () => {
  const [editor, backend] = await Promise.all([
    read('src/quotes/AdminQuotes.tsx'),
    read('supabase/functions/quote-admin/index.ts'),
  ])

  assert.match(editor, /action: 'save_quote'/)
  assert.match(backend, /action: 'save_quote'/)
  assert.match(backend, /resolveCatalogRows/)
  assert.match(backend, /draft_catalog_calculation_saved/)
})

test('orçamento aprovado possui ações explícitas de envio', async () => {
  const editor = await read('src/quotes/AdminQuotes.tsx')

  assert.match(editor, /Orçamento aprovado/)
  assert.match(editor, /navigator\.share/)
  assert.match(editor, /wa\.me/)
  assert.match(editor, /mailto:/)
  assert.match(editor, /navigator\.clipboard\.writeText/)
  assert.match(editor, /draft\.status === 'approved'/)
})

test('mobile separa fila e detalhe como telas de aplicativo', async () => {
  const [editor, css] = await Promise.all([
    read('src/quotes/AdminQuotes.tsx'),
    read('src/quotes/quotes.css'),
  ])

  assert.match(editor, /is-mobile-detail-open/)
  assert.match(editor, /admin-mobile-back/)
  assert.match(editor, /admin-mobile-nav/)
  assert.match(css, /\.admin-live-shell\.is-mobile-detail-open \.admin-queue\{display:none\}/)
  assert.match(css, /\.admin-live-shell\.is-mobile-detail-open \.admin-detail\{display:block\}/)
})
