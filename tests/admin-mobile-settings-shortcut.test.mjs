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
  const shell = await read('src/quotes/admin-unified-shell.css')
  assert.match(shell, /position:fixed!important/)
  assert.match(shell, /left:50%!important/)
  assert.match(shell, /transform:translateX\(-50%\)!important/)
})

test('mobile overlays remain below the iOS safe area in the canonical shell', async () => {
  const [css, chrome] = await Promise.all([
    read('src/quotes/admin-unified-shell.css'),
    read('src/quotes/admin-unified-chrome.css'),
  ])

  assert.match(css, /\.hrx-pwa-secondary\{[\s\S]*top:calc\(64px \+ env\(safe-area-inset-top\)\)/)
  assert.match(css, /--hrx-dock-bottom:6px/)
  assert.match(css, /--hrx-dock-control-lift:max\(0px,calc\(var\(--hrx-safe-bottom\) - 28px\)\)/)
  assert.match(css, /padding:var\(--hrx-safe-top\)/)
})
