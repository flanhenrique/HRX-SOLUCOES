import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('quote-only mobile CSS is lazy-loaded by Orçamentos and never by the global shell', async () => {
  const [app, quotesApp, css] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminQuotes.tsx'),
    read('src/quotes/admin-quotes-mobile.css'),
  ])

  assert.doesNotMatch(app, /admin-quotes-mobile\.css/)
  assert.match(quotesApp, /import '\.\/admin-quotes-mobile\.css'/)
  assert.match(css, /A view lazy não controla viewport, shell, dock nem a área global de rolagem/)
  assert.match(css, /\.admin-workspace\.quote-workspace\{[\s\S]*height:auto!important;[\s\S]*overflow:visible!important/)
  assert.match(css, /\.admin-queue-list\{[\s\S]*overflow:visible!important/)
  assert.match(css, /bottom:var\(--hrx-dock-clearance\)!important/)
})

test('quote route keeps mobile contrast without repainting the global shell', async () => {
  const css = await read('src/quotes/admin-quotes-mobile.css')
  assert.match(css, /data-hrx-theme-resolved="light"[\s\S]*\.admin-exec-metrics strong\{color:#102235!important\}/)
  assert.match(css, /\.quote-queue \.admin-queue-header strong\{color:#183149!important\}/)
  assert.doesNotMatch(css, /--hrx-pwa-canvas|\.hrx-pwa-topbar|\.hrx-unified-mobile-nav/)
})
