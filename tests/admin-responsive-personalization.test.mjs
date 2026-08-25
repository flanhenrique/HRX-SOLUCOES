import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin separates runtime mode from phone/tablet/desktop viewport class', async () => {
  const [root, shellCss, chromeCss] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/admin-unified-shell.css'),
    read('src/quotes/admin-unified-chrome.css'),
  ])

  assert.match(root, /type RuntimeMode = 'standalone' \| 'browser'/)
  assert.match(root, /type ViewportClass = 'phone' \| 'tablet' \| 'desktop'/)
  assert.match(root, /display-mode: standalone/)
  assert.match(root, /standalone\?: boolean/)
  assert.match(root, /window\.innerWidth <= 760/)
  assert.match(root, /window\.innerWidth <= 1100/)
  assert.match(root, /data-runtime=\{runtime\}/)
  assert.match(root, /data-viewport=\{viewport\}/)
  assert.match(shellCss, /--hrx-safe-top:env\(safe-area-inset-top,0px\)/)
  assert.match(shellCss, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-mobile-nav\{[\s\S]*bottom:var\(--hrx-dock-bottom\)!important/)
  assert.match(chromeCss, /data-viewport="tablet"/)
  assert.match(chromeCss, /orientation:landscape/)
})

test('personalization persists locally and syncs non-sensitive preferences without notification DOM observers', async () => {
  const [bridge, root, adminApp] = await Promise.all([
    read('src/quotes/AdminPersonalizationBridge.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminApp.tsx'),
  ])

  assert.match(adminApp, /AdminUnifiedRoot/)
  assert.match(root, /<AdminPersonalizationBridge settingsActive=\{active === 'settings'\} \/>/)
  assert.match(bridge, /hrx_ui_preferences/)
  assert.match(bridge, /localStorage\.setItem/)
  assert.match(bridge, /auth\.updateUser/)
  assert.match(bridge, /Restaurar padrão HRX/)
  assert.match(bridge, /Aparência/)
  assert.match(bridge, /Cor de destaque/)
  assert.match(bridge, /Densidade/)
  assert.match(bridge, /Tamanho da interface/)
  assert.doesNotMatch(bridge, /MutationObserver/)
  assert.doesNotMatch(bridge, /\.hrx-notifications/)
  assert.doesNotMatch(bridge, /\.click\(\)/)
})

test('notification bell and panel are controlled by React with database counts', async () => {
  const [bridge, root, chrome] = await Promise.all([
    read('src/quotes/AdminPersonalizationBridge.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/admin-unified-chrome.css'),
  ])

  assert.match(root, /function NotificationButton/)
  assert.match(root, /function NotificationPanel/)
  assert.match(root, /aria-haspopup="dialog"/)
  assert.match(root, /aria-expanded=\{open\}/)
  assert.match(root, /head:\s*true/)
  assert.match(root, /count:\s*'exact'/)
  assert.match(root, /AlertLoadStatus = 'loading' \| 'ready' \| 'unavailable'/)
  assert.match(root, /navigateAdmin\(destination\)/)
  assert.doesNotMatch(bridge, /MutationObserver|addEventListener\('click'|clickAdminNavigation/)
  assert.doesNotMatch(chrome, /top:-6px|right:-5px/)
  assert.match(chrome, /top:2px!important;right:2px!important/)
})
