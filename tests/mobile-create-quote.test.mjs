import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('manual quote creation lives in Clients without a duplicate mobile bridge', async () => {
  const [main, adminApp, root, clients, experience] = await Promise.all([
    read('src/main.tsx'),
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminClientsPage.tsx'),
    read('src/quotes/AdminExperienceLayer.tsx'),
  ])

  assert.doesNotMatch(main, /MobileCreateQuoteButton|AdminOperationsHub|mobile-create-quote\.css/)
  assert.match(adminApp, /<AdminUnifiedRoot \/>/)
  assert.doesNotMatch(adminApp, /<AdminExperienceLayer \/>/)
  assert.match(root, /coreDestinations\.has\(destination\)[\s\S]*<AdminExperienceLayer \/>/)
  assert.match(experience, /Novo orçamento/)
  assert.match(experience, /hrx_create_manual_quote/)
  assert.match(experience, /view: 'clients'/)
  assert.match(root, /className="hrx-mobile-nav hrx-unified-mobile-nav"/)
  assert.doesNotMatch(experience, /createPortal|MutationObserver/)
  assert.doesNotMatch(clients, /createPortal|MutationObserver/)
})
