import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile admin uses the official HRX logo and a floating bottom navigation', async () => {
  const css = await read('src/quotes/admin-mobile-safe-area-fixes.css')

  assert.match(css, /background:url\('\/hrx-logo\.svg'\)/)
  assert.match(css, /\.hrx-glass-main\{inset:var\(--hrx-topbar\) 0 0 0;bottom:0/)
  assert.match(css, /\.hrx-view\{padding-bottom:calc\(108px \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(css, /\.hrx-mobile-nav\{[\s\S]*inset:auto max\(12px,env\(safe-area-inset-right\)\) max\(10px,env\(safe-area-inset-bottom\)\) max\(12px,env\(safe-area-inset-left\)\)/)
  assert.match(css, /border-radius:20px/)
  assert.match(css, /backdrop-filter:blur\(24px\)/)
})
