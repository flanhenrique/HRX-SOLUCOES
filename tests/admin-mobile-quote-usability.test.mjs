import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile quote usability layer is loaded last and neutralizes legacy spacing', async () => {
  const [app, css] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/admin-mobile-usability-fixes.css'),
  ])

  const chromeImport = app.indexOf("import './admin-unified-chrome.css'")
  const usabilityImport = app.indexOf("import './admin-mobile-usability-fixes.css'")
  assert.ok(chromeImport >= 0, 'chrome canônico precisa continuar carregado')
  assert.ok(usabilityImport > chromeImport, 'correções mobile devem ser carregadas por último')

  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-content\{[\s\S]*padding-bottom:104px!important/)
  assert.match(css, /\.quote-commercial-shell \.admin-exec-main\{[\s\S]*padding-bottom:0!important/)
  assert.match(css, /\.admin-exec-topbar\.quote-topbar\{[\s\S]*background:transparent!important/)
  assert.match(css, /\.admin-exec-metrics article\{[\s\S]*min-height:68px!important/)
  assert.match(css, /\.admin-workspace\.quote-workspace\{[\s\S]*min-height:0!important[\s\S]*padding:0 12px 12px!important/)
  assert.match(css, /::-webkit-scrollbar\{display:none\}/)
})

test('light quote theme explicitly restores contrast for KPIs and proposal list', async () => {
  const css = await read('src/quotes/admin-mobile-usability-fixes.css')

  assert.match(css, /data-hrx-theme-resolved="light"[\s\S]*\.admin-exec-metrics strong\{color:#102235!important\}/)
  assert.match(css, /\.quote-queue \.admin-queue-header strong\{color:#183149!important\}/)
  assert.match(css, /\.quote-queue \.admin-lead strong,[\s\S]*\.quote-queue \.admin-lead b\{color:#183149!important\}/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-pwa-topbar\{[\s\S]*linear-gradient\(135deg,rgba\(7,24,45,.98\),rgba\(15,43,70,.97\)\)/)
})
