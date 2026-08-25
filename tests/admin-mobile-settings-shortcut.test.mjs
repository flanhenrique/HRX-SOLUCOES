import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('PWA expõe Configurações pelo menu Mais do dock canônico', async () => {
  const [adminApp, root, modules, chrome] = await Promise.all([
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/adminModules.ts'),
    read('src/quotes/admin-unified-chrome.css'),
  ])

  assert.match(adminApp, /AdminUnifiedRoot/)
  assert.doesNotMatch(adminApp, /AdminSettingsShortcut/)
  assert.match(root, /function PwaShell/)
  assert.match(root, /ADMIN_MOBILE_MORE_MODULES\.map/)
  assert.match(root, /hrx-unified-mobile-nav/)
  assert.match(root, /<span>Mais<\/span>/)
  const settingsBlock = modules.slice(modules.indexOf("id: 'settings'"), modules.indexOf("id: 'settings'") + 600)
  assert.match(settingsBlock, /mobileNavigation: 'more'/)
  assert.match(settingsBlock, /title: 'Configurações'/)
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
  assert.match(chrome, /\.hrx-pwa-settings/)
})
