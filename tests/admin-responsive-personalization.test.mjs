import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile admin separates usable topbar height from iOS safe area', async () => {
  const css = await read('src/quotes/admin-responsive-hardening.css')

  assert.match(css, /--hrx-topbar:calc\(56px \+ env\(safe-area-inset-top\)\)/)
  assert.match(css, /--hrx-mobile-nav-height:calc\(56px \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(css, /\.hrx-glass-main\{inset:var\(--hrx-topbar\) 0 var\(--hrx-mobile-nav-height\) 0/)
  assert.match(css, /padding-right:max\(13px,env\(safe-area-inset-right\)\)/)
  assert.match(css, /padding-left:max\(13px,env\(safe-area-inset-left\)\)/)
  assert.match(css, /\.hrx-filterbar\{width:100%;flex-wrap:wrap/)
  assert.match(css, /@media\(max-width:350px\)[\s\S]*\.hrx-metric-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
})

test('personalization persists locally and syncs non-sensitive preferences to the signed-in account', async () => {
  const [bridge, adminApp] = await Promise.all([
    read('src/quotes/AdminPersonalizationBridge.tsx'),
    read('src/quotes/AdminApp.tsx'),
  ])

  assert.match(adminApp, /AdminPersonalizationBridge/)
  assert.match(adminApp, /admin-responsive-hardening\.css/)
  assert.match(bridge, /hrx_ui_preferences/)
  assert.match(bridge, /localStorage\.setItem/)
  assert.match(bridge, /auth\.updateUser/)
  assert.match(bridge, /Restaurar padrão HRX/)
  assert.match(bridge, /Aparência/)
  assert.match(bridge, /Cor de destaque/)
  assert.match(bridge, /Densidade/)
  assert.match(bridge, /Tamanho da interface/)
})

test('notification bell is actionable and routes to real admin workspaces', async () => {
  const bridge = await read('src/quotes/AdminPersonalizationBridge.tsx')

  assert.match(bridge, /\.hrx-notifications/)
  assert.match(bridge, /aria-haspopup/)
  assert.match(bridge, /Ver atividades e bloqueios/)
  assert.match(bridge, /Revisar documentos/)
  assert.match(bridge, /clickAdminNavigation\('Atividades'\)/)
  assert.match(bridge, /clickAdminNavigation\('Central de Documentos'\)/)
})
