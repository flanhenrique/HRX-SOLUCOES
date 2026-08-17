import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const quotes = await readFile(new URL('../src/quotes/AdminQuotes.tsx', import.meta.url), 'utf8')

test('orçamento suspenso não compõe o volume em análise', () => {
  assert.match(quotes, /item\.draft\?\.status === 'rejected' \|\| item\.draft\?\.status === 'suspended'/)
  assert.match(quotes, /suspended:\s*'Suspenso'/)
})
