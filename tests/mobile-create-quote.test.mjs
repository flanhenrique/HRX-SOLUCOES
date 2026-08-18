import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('manual quote creation lives in Clients without a duplicate mobile bridge', async () => {
  const [main, adminApp, clients, experience] = await Promise.all([
    read('src/main.tsx'),
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminClientsPage.tsx'),
    read('src/quotes/AdminExperienceLayer.tsx'),
  ])

  assert.doesNotMatch(main, /MobileCreateQuoteButton|AdminOperationsHub|mobile-create-quote\.css/)
  assert.match(adminApp, /<AdminClientsPage \/>/)
  assert.match(clients, /\+ Orçamento/)
  assert.match(clients, /Novo orçamento/)
  assert.match(clients, /hrx_create_manual_quote/)
  assert.match(experience, /openDestination\('clients'\)/)
  assert.doesNotMatch(clients, /createPortal|MutationObserver/)
})
