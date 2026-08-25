import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('PWA mobile keeps the dock fixed while only content scrolls', async () => {
  const [app, css, finance] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/admin-mobile-floating-dock-fix.css'),
    read('src/quotes/AdminPersonalFinancePage.tsx'),
  ])

  assert.match(app, /import '\.\/admin-mobile-floating-dock-fix\.css'/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa\{[\s\S]*padding:0!important/)
  assert.match(css, /--hrx-dock-bottom:8px/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-content\{[\s\S]*overflow-y:auto!important/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-mobile-nav\{[\s\S]*position:fixed!important/)
  assert.match(css, /bottom:var\(--hrx-dock-bottom\)!important/)
  assert.match(css, /\.personal-finance-page\{[\s\S]*padding-bottom:0!important/)
  assert.match(css, /button\.is-primary\{[\s\S]*position:static!important/)
  assert.match(css, /html\.hrx-finance-modal-open[\s\S]*\.hrx-unified-mobile-nav[\s\S]*visibility:hidden!important/)

  assert.match(finance, /import \{ createPortal \} from 'react-dom'/)
  assert.match(finance, /function useFinanceModalViewportLock\(\)/)
  assert.match(finance, /document\.documentElement\.classList\.add\('hrx-finance-modal-open'\)/)
  assert.match(finance, /return createPortal\(<div className="finance-modal-backdrop"/)
  assert.match(finance, /, document\.body\)/)
})

test('iPhone standalone shell is anchored by inset instead of 100dvh', async () => {
  const css = await read('src/quotes/admin-mobile-floating-dock-fix.css')
  const shellBlock = css.match(/\.hrx-unified-shell\.is-pwa\{([\s\S]*?)\n  \}/)?.[1] ?? ''

  assert.match(shellBlock, /position:fixed!important/)
  assert.match(shellBlock, /inset:0!important/)
  assert.match(shellBlock, /height:auto!important/)
  assert.match(shellBlock, /max-height:none!important/)
  assert.doesNotMatch(shellBlock, /100dvh/)
  assert.match(css, /--hrx-dock-bottom:8px/)
  assert.match(css, /--hrx-dock-bottom:5px/)
})

test('dock is a true overlay and does not create permanent dead space at page end', async () => {
  const css = await read('src/quotes/admin-mobile-floating-dock-fix.css')

  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-content\{[\s\S]*padding:0!important/)
  assert.match(css, /scroll-padding-bottom:calc\(var\(--hrx-dock-height\) \+ 20px\)!important/)
  assert.match(css, /:focus\{[\s\S]*scroll-margin-bottom:calc\(var\(--hrx-dock-height\) \+ 20px\)!important/)
  assert.doesNotMatch(css, /\n\s+padding-bottom:calc\(var\(--hrx-dock-height\)/)
})

test('lazy-loaded quote CSS cannot restore the obsolete bottom reservation', async () => {
  const css = await read('src/quotes/admin-mobile-floating-dock-fix.css')

  assert.match(css, /html\.hrx-admin-pwa \.hrx-unified-shell\.is-pwa>\.hrx-unified-content>\.admin-live-shell\.quote-commercial-shell>\.admin-exec-main\{[\s\S]*padding:0!important/)
  assert.match(css, /\.admin-workspace\.quote-workspace\{[\s\S]*padding:0 12px!important/)
  assert.match(css, /\.admin-queue-list\{[\s\S]*padding:7px!important/)
  assert.match(css, /\.admin-lead:last-child\{[\s\S]*margin-bottom:0!important/)
})

test('light PWA canvas continues behind the dock without a navy bottom strip', async () => {
  const css = await read('src/quotes/admin-mobile-floating-dock-fix.css')

  assert.match(css, /--hrx-pwa-canvas:#081a2f/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-content\{[\s\S]*background:var\(--hrx-pwa-canvas\)!important/)
  assert.match(css, /html\[data-hrx-theme-resolved="light"\]\.hrx-admin-pwa:has\(\.hrx-unified-shell\)[\s\S]*background:#f3f7fa!important/)
  assert.match(css, /html\[data-hrx-theme-resolved="light"\] \.hrx-unified-shell\.is-pwa\{[\s\S]*--hrx-pwa-canvas:#f3f7fa/)
  assert.match(css, /html\[data-hrx-theme-resolved="light"\] \.hrx-unified-shell\.is-pwa>\.hrx-unified-content\{[\s\S]*background:#f3f7fa!important/)
})