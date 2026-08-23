import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('PWA exposes one visible settings entry through the floating bottom navigation', async () => {
  const [adminApp, root, chrome] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/admin-unified-chrome.css'),
  ])

  assert.match(adminApp, /AdminUnifiedRoot/)
  assert.doesNotMatch(adminApp, /AdminSettingsShortcut/)
  assert.match(root, /function PwaShell/)
  assert.match(root, /const pwaPrimary/)
  assert.match(root, /'settings'/)
  assert.match(root, /hrx-unified-mobile-nav/)
  assert.match(chrome, /\.hrx-unified-shell\.is-pwa \.hrx-pwa-settings\{display:none!important\}/)
  assert.match(chrome, /position:fixed!important/)
  assert.match(chrome, /left:50%!important/)
  assert.match(chrome, /transform:translateX\(-50%\)!important/)
})

test('mobile overlays remain below the iOS safe area in the canonical shell', async () => {
  const [css, chrome] = await Promise.all([
    read('src/quotes/admin-unified-shell.css'),
    read('src/quotes/admin-unified-chrome.css'),
  ])

  assert.match(css, /\.hrx-pwa-secondary\{[\s\S]*top:calc\(64px \+ env\(safe-area-inset-top\)\)/)
  assert.match(chrome, /bottom:max\(12px,calc\(env\(safe-area-inset-bottom\) \+ 8px\)\)!important/)
  assert.match(css, /padding-top:env\(safe-area-inset-top\)/)
})
