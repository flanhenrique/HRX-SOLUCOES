import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile admin usa o shell PWA canônico com quatro módulos primários e Mais', async () => {
  const [root, modules, css] = await Promise.all([
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/adminModules.ts'),
    read('src/quotes/admin-unified-shell.css'),
  ])

  assert.match(root, /function PwaShell/)
  assert.match(root, /<img src="\/hrx-logo\.svg"/)
  assert.match(root, /hrx-unified-mobile-nav/)
  assert.match(root, /ADMIN_MOBILE_PRIMARY_MODULES\.map/)
  assert.match(root, /<span>Mais<\/span>/)
  for (const id of ['executive', 'quotes', 'clients', 'finance']) {
    const block = modules.slice(modules.indexOf(`id: '${id}'`), modules.indexOf(`id: '${id}'`) + 500)
    assert.match(block, /mobileNavigation: 'primary'/, `${id} deve permanecer no dock primário`)
  }
  assert.match(css, /--hrx-safe-top:env\(safe-area-inset-top,0px\)/)
  assert.match(css, /--hrx-safe-right:env\(safe-area-inset-right,0px\)/)
  assert.match(css, /--hrx-safe-bottom:env\(safe-area-inset-bottom,0px\)/)
  assert.match(css, /--hrx-safe-left:env\(safe-area-inset-left,0px\)/)
  assert.match(css, /--hrx-dock-bottom:6px/)
  assert.match(css, /--hrx-dock-control-lift:max\(0px,calc\(var\(--hrx-safe-bottom\) - 28px\)\)/)
  assert.match(css, /bottom:var\(--hrx-dock-bottom\)!important/)
  assert.match(css, /border-radius:22px!important/)
  assert.match(css, /backdrop-filter:blur\(24px\) saturate\(1\.12\)!important/)
  assert.match(css, /overflow-x:hidden/)
})
