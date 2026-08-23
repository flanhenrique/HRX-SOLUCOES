import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile admin separates PWA safe area from the desktop shell', async () => {
  const [root, css] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/admin-unified-shell.css'),
  ])

  assert.match(root, /function DesktopShell/)
  assert.match(root, /function PwaShell/)
  assert.match(root, /window\.matchMedia\('\(max-width: 760px\)'\)/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa\{[\s\S]*padding-top:env\(safe-area-inset-top\)/)
  assert.match(css, /\.hrx-unified-mobile-nav\{[\s\S]*bottom:max\(8px,env\(safe-area-inset-bottom\)\)!important/)
  assert.match(css, /\.hrx-unified-shell\.is-desktop\{[\s\S]*grid-template-columns:var\(--hrx-shell-sidebar\)/)
})

test('personalization persists locally and syncs non-sensitive preferences to the signed-in account', async () => {
  const [bridge, root, adminApp] = await Promise.all([
    read('src/quotes/AdminPersonalizationBridge.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminApp.tsx'),
  ])

  assert.match(adminApp, /AdminUnifiedRoot/)
  assert.match(root, /<AdminPersonalizationBridge \/>/)
  assert.match(bridge, /hrx_ui_preferences/)
  assert.match(bridge, /localStorage\.setItem/)
  assert.match(bridge, /auth\.updateUser/)
  assert.match(bridge, /Restaurar padrão HRX/)
  assert.match(bridge, /Aparência/)
  assert.match(bridge, /Cor de destaque/)
  assert.match(bridge, /Densidade/)
  assert.match(bridge, /Tamanho da interface/)
})

test('notification bell remains actionable in the canonical chrome', async () => {
  const [bridge, root] = await Promise.all([
    read('src/quotes/AdminPersonalizationBridge.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
  ])

  assert.match(root, /className="hrx-notifications"/)
  assert.match(root, /from\('quote_drafts'\)/)
  assert.match(root, /from\('hrx_documents'\)/)
  assert.match(bridge, /\.hrx-notifications/)
  assert.match(bridge, /aria-haspopup/)
  assert.match(bridge, /Ver atividades e bloqueios/)
  assert.match(bridge, /Revisar documentos/)
})
