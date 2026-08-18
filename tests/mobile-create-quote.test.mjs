import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('PWA mobile keeps a visible create quote action without a duplicate bridge component', async () => {
  const [main, css, operations] = await Promise.all([
    read('src/main.tsx'),
    read('src/quotes/mobile-create-quote.css'),
    read('src/quotes/AdminOperationsHub.tsx'),
  ])

  assert.doesNotMatch(main, /MobileCreateQuoteButton/)
  assert.match(main, /mobile-create-quote\.css/)
  assert.match(operations, /className="admin-ops-new-quote"/)
  assert.match(operations, /\+ Orçamento manual/)
  assert.match(operations, /hrx_create_manual_quote/)
  assert.match(css, /@media\(max-width:860px\)/)
  assert.match(css, /\.admin-ops-new-quote/)
  assert.match(css, /display:inline-flex!important/)
  assert.match(css, /\.admin-ops-mobile\{display:none!important\}/)
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/)
})
