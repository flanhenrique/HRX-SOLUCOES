import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile admin uses the official HRX logo, document scrolling and a lower floating nav', async () => {
  const css = await read('src/quotes/admin-mobile-safe-area-fixes.css')

  assert.match(css, /background:url\('\/hrx-logo\.svg'\)/)
  assert.match(css, /:has\(\.hrx-glass-app\) body\{position:static;inset:auto/)
  assert.match(css, /:has\(\.hrx-glass-app\) #root\{width:100%;min-height:100dvh;height:auto;overflow:visible\}/)
  assert.match(css, /\.hrx-glass-app\{position:relative;inset:auto;width:100%;min-height:100dvh;height:auto;overflow:visible\}/)
  assert.match(css, /\.hrx-glass-topbar\{position:sticky;/)
  assert.match(css, /\.hrx-glass-main\{position:relative;inset:auto;/)
  assert.match(css, /\.hrx-view\{min-height:calc\(100dvh - var\(--hrx-topbar\)\);padding-bottom:calc\(92px \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(css, /\.hrx-mobile-nav\{[\s\S]*bottom:clamp\(8px,env\(safe-area-inset-bottom\),30px\)/)
  assert.match(css, /border-radius:20px/)
  assert.match(css, /backdrop-filter:blur\(24px\)/)
})
