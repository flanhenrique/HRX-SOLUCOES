import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('PWA mobile keeps a visible create quote action', async () => {
  const [main, bridge, css, operations] = await Promise.all([
    read('src/main.tsx'),
    read('src/quotes/MobileCreateQuoteButton.tsx'),
    read('src/quotes/mobile-create-quote.css'),
    read('src/quotes/AdminOperationsHub.tsx'),
  ])

  assert.match(main, /<MobileCreateQuoteButton \/>/)
  assert.match(bridge, /Criar orçamento/)
  assert.match(bridge, /\.admin-ops-new-quote/)
  assert.match(css, /@media\(max-width:860px\)/)
  assert.match(css, /display:inline-flex!important/)
  assert.match(operations, /hrx_create_manual_quote/)
})
