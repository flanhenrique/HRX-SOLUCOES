import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('iPhone PWA applies the safe area once without increasing dock height', async () => {
  const [index, app, css] = await Promise.all([
    read('index.html'),
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/admin-unified-shell.css'),
  ])

  assert.match(index, /name="viewport"[^>]*viewport-fit=cover/)
  assert.match(app, /import '\.\/admin-unified-shell\.css'/)
  assert.doesNotMatch(app, /admin-(mobile-safe-area-fixes|mobile-floating-dock-fix|ios-viewport-dock-fix)/)
  assert.match(css, /--hrx-safe-bottom:env\(safe-area-inset-bottom,0px\)/)
  assert.match(css, /--hrx-dock-height:64px/)
  assert.match(css, /--hrx-dock-bottom:6px/)
  assert.match(css, /--hrx-dock-control-lift:max\(0px,calc\(var\(--hrx-safe-bottom\) - 28px\)\)/)
  assert.match(css, /height:var\(--hrx-dock-height\)!important/)
  assert.match(css, /padding:4px 6px!important/)
  assert.match(css, /translateY\(calc\(0px - var\(--hrx-dock-control-lift\)\)\)/)
  assert.doesNotMatch(css, /height:calc\(var\(--hrx-dock-height\) \+ var\(--hrx-safe-bottom\)\)/)
})
