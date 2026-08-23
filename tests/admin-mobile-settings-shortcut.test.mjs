import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile topbar exposes an explicit settings shortcut', async () => {
  const [adminApp, shortcut] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminSettingsShortcut.tsx'),
  ])

  assert.match(adminApp, /AdminSettingsShortcut/)
  assert.match(shortcut, /max-width: 760px/)
  assert.match(shortcut, /Abrir configurações de aparência/)
  assert.match(shortcut, /textContent\?\.includes\('Configurações'\)/)
})

test('mobile overlays remain below the iOS safe area', async () => {
  const [adminApp, css] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/admin-mobile-safe-area-fixes.css'),
  ])

  assert.match(adminApp, /admin-mobile-safe-area-fixes\.css/)
  assert.match(css, /\.hrx-notification-panel\{top:calc\(64px \+ env\(safe-area-inset-top\)\)\}/)
  assert.match(css, /\.hrx-loading\{top:calc\(64px \+ env\(safe-area-inset-top\)\)/)
})
