import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('PWA mobile keeps the dock fixed while only content scrolls', async () => {
  const [app, css] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/admin-mobile-floating-dock-fix.css'),
  ])

  assert.match(app, /import '\.\/admin-mobile-floating-dock-fix\.css'/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-content\{[\s\S]*overflow-y:auto!important/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-mobile-nav\{[\s\S]*position:fixed!important/)
  assert.match(css, /bottom:max\(10px,calc\(env\(safe-area-inset-bottom\) \+ 8px\)\)!important/)
  assert.match(css, /\.personal-finance-page\{[\s\S]*padding-bottom:calc\(112px \+ env\(safe-area-inset-bottom\)\)!important/)
  assert.match(css, /button\.is-primary\{[\s\S]*position:static!important/)
  assert.match(css, /:has\(\.finance-modal-backdrop\)>\.hrx-unified-mobile-nav\{[\s\S]*visibility:hidden!important/)
})
