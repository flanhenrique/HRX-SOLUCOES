import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('iPhone PWA covers the physical safe area and makes the dock own the bottom inset', async () => {
  const [index, app, css] = await Promise.all([
    read('index.html'),
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/admin-ios-viewport-dock-fix.css'),
  ])

  assert.match(index, /name="viewport"[^>]*viewport-fit=cover/)
  assert.match(app, /import '\.\/admin-mobile-floating-dock-fix\.css'/)
  assert.match(app, /import '\.\/admin-ios-viewport-dock-fix\.css'/)
  assert.ok(app.indexOf("admin-ios-viewport-dock-fix.css") > app.indexOf("admin-mobile-floating-dock-fix.css"))

  assert.match(css, /--hrx-ios-tabbar-safe-bottom:env\(safe-area-inset-bottom\)/)
  assert.match(css, /--hrx-ios-tabbar-total-height:calc\(var\(--hrx-ios-tabbar-content-height\) \+ var\(--hrx-ios-tabbar-safe-bottom\)\)/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-mobile-nav\{[\s\S]*bottom:0!important/)
  assert.match(css, /height:var\(--hrx-ios-tabbar-total-height\)!important/)
  assert.match(css, /padding:4px 6px calc\(4px \+ var\(--hrx-ios-tabbar-safe-bottom\)\)!important/)
  assert.match(css, /border-radius:20px 20px 0 0!important/)
  assert.match(css, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-content\{[\s\S]*padding-bottom:0!important/)
})
