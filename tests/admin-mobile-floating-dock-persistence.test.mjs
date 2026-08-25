import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('canonical PWA shell owns viewport, scroll and overlay dock geometry', async () => {
  const [app, css, finance] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/admin-unified-shell.css'),
    read('src/quotes/AdminPersonalFinancePage.tsx'),
  ])

  assert.match(app, /import '\.\/admin-unified-shell\.css'/)
  assert.match(css, /\.hrx-unified-shell\{[\s\S]*position:fixed;[\s\S]*inset:0;[\s\S]*height:auto;/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-content\{[\s\S]*overflow-y:auto;[\s\S]*scroll-padding-block-end:var\(--hrx-dock-clearance\)/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-mobile-nav\{[\s\S]*position:fixed!important;[\s\S]*bottom:var\(--hrx-dock-bottom\)!important/)
  assert.match(css, /html\.hrx-finance-modal-open[\s\S]*\.hrx-unified-mobile-nav[\s\S]*visibility:hidden!important/)
  assert.match(finance, /import \{ createPortal \} from 'react-dom'/)
  assert.match(finance, /return createPortal\(<div className="finance-modal-backdrop"/)
})

test('obsolete competing mobile shell styles were removed', async () => {
  for (const path of [
    'src/quotes/admin-mobile-safe-area-fixes.css',
    'src/quotes/admin-mobile-floating-dock-fix.css',
    'src/quotes/admin-ios-viewport-dock-fix.css',
    'src/quotes/admin-mobile-usability-fixes.css',
  ]) {
    await assert.rejects(access(new URL(`../${path}`, import.meta.url)))
  }
})

test('lazy quote view cannot become a second fullscreen shell', async () => {
  const [app, quotes, routeCss] = await Promise.all([
    read('src/quotes/AdminQuotes.tsx'),
    read('src/quotes/quotes.css'),
    read('src/quotes/admin-quotes-mobile.css'),
  ])

  assert.match(app, /import '\.\/admin-quotes-mobile\.css'/)
  assert.match(quotes, /\.admin-live-shell\{position:relative;inset:auto;/)
  assert.doesNotMatch(quotes, /\.admin-live-shell\{position:fixed;inset:0;/)
  assert.match(routeCss, /\.quote-commercial-shell \.admin-exec-main\{[\s\S]*overflow:visible!important;[\s\S]*padding-bottom:0!important/)
  assert.doesNotMatch(routeCss, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-(content|mobile-nav)/)
})
