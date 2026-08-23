import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile topbar exposes settings inside the dedicated PWA shell', async () => {
  const [adminApp, root] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
  ])

  assert.match(adminApp, /AdminUnifiedRoot/)
  assert.doesNotMatch(adminApp, /AdminSettingsShortcut/)
  assert.match(root, /function PwaShell/)
  assert.match(root, /className="hrx-pwa-settings"/)
  assert.match(root, /aria-label="Abrir configurações"/)
  assert.match(root, /go\('settings'\)/)
})

test('mobile overlays remain below the iOS safe area in the canonical shell', async () => {
  const css = await read('src/quotes/admin-unified-shell.css')

  assert.match(css, /\.hrx-pwa-secondary\{[\s\S]*top:calc\(64px \+ env\(safe-area-inset-top\)\)/)
  assert.match(css, /\.hrx-unified-mobile-nav\{[\s\S]*bottom:max\(8px,env\(safe-area-inset-bottom\)\)!important/)
  assert.match(css, /padding-top:env\(safe-area-inset-top\)/)
})
