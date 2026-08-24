import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('manual quote creation lives in Clients without a duplicate mobile bridge', async () => {
  const [main, adminApp, root, clients] = await Promise.all([
    read('src/main.tsx'),
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminClientsPage.tsx'),
  ])

  assert.doesNotMatch(main, /MobileCreateQuoteButton|AdminOperationsHub|mobile-create-quote\.css/)
  assert.match(adminApp, /<AdminUnifiedRoot \/>/)
  assert.doesNotMatch(adminApp, /<AdminExperienceLayer \/>/)
  assert.doesNotMatch(root, /AdminExperienceLayer/)
  assert.match(clients, /\+ Cliente/)
  assert.match(clients, /hrx_create_manual_quote/)
  assert.match(root, /className="hrx-mobile-nav hrx-unified-mobile-nav"/)
  assert.doesNotMatch(clients, /createPortal|MutationObserver/)
})
