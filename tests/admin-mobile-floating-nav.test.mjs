import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile admin uses a dedicated PWA shell with safe areas and a lower floating nav', async () => {
  const [root, css] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/admin-unified-shell.css'),
  ])

  assert.match(root, /function PwaShell/)
  assert.match(root, /<img src="\/hrx-logo\.svg"/)
  assert.match(root, /hrx-unified-mobile-nav/)
  assert.match(root, /const pwaPrimary/)
  assert.match(css, /padding-top:env\(safe-area-inset-top\)/)
  assert.match(css, /padding-right:env\(safe-area-inset-right\)/)
  assert.match(css, /padding-bottom:env\(safe-area-inset-bottom\)/)
  assert.match(css, /padding-left:env\(safe-area-inset-left\)/)
  assert.match(css, /\.hrx-unified-mobile-nav\{[\s\S]*bottom:max\(8px,env\(safe-area-inset-bottom\)\)!important/)
  assert.match(css, /border-radius:20px!important/)
  assert.match(css, /backdrop-filter:blur\(24px\) saturate\(1\.12\)!important/)
  assert.match(css, /overflow-x:hidden/)
})
