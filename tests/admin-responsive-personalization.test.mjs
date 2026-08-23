import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile admin respects iOS safe areas without pushing controls outside the viewport', async () => {
  const css = await read('src/quotes/admin-personalization.css')

  assert.match(css, /--hrx-topbar:calc\(60px \+ env\(safe-area-inset-top\)\)/)
  assert.match(css, /max\(12px,env\(safe-area-inset-right\)\)/)
  assert.match(css, /max\(12px,env\(safe-area-inset-left\)\)/)
  assert.match(css, /bottom:calc\(58px \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/)
  assert.match(css, /\.hrx-notifications,\.hrx-account,\.hrx-personalize-trigger\{flex:0 0 auto\}/)
})

test('admin exposes functional personalization and notification navigation', async () => {
  const [component, app] = await Promise.all([
    read('src/quotes/AdminPersonalization.tsx'),
    read('src/quotes/AdminApp.tsx'),
  ])

  assert.match(component, /Personalizar interface/)
  assert.match(component, /navigateAdmin\('activities'\)/)
  assert.match(component, /hrx_ui_preferences/)
  assert.match(component, /Restaurar padrão HRX/)
  assert.match(component, /appearance: 'system'/)
  assert.match(component, /accent: 'blue'/)
  assert.match(component, /density: 'comfortable'/)
  assert.match(app, /<AdminPersonalization \/>/)
  assert.ok(app.indexOf("./admin-liquid-glass.css") < app.indexOf("./admin-personalization.css"))
})
