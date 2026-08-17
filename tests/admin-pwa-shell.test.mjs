import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin PWA locks viewport, orientation and horizontal overflow', async () => {
  const [shell, css, manifestText, sw, deploy, publicIndex] = await Promise.all([
    read('src/quotes/adminAppShell.ts'),
    read('src/quotes/app-shell.css'),
    read('public/admin/manifest.webmanifest'),
    read('public/admin/sw.js'),
    read('.github/workflows/deploy-pages.yml'),
    read('index.html'),
  ])
  const manifest = JSON.parse(manifestText)

  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.orientation, 'portrait-primary')

  assert.match(shell, /maximum-scale=1/)
  assert.match(shell, /user-scalable=no/)
  assert.match(shell, /viewport-fit=cover/)
  assert.match(shell, /gesturestart/)
  assert.match(shell, /event\.ctrlKey/)

  assert.match(css, /html\.hrx-admin-pwa body[\s\S]*position:\s*fixed/)
  assert.match(css, /\.admin-live-shell[\s\S]*height:\s*100dvh/)
  assert.match(css, /\.admin-workspace[\s\S]*overflow:\s*hidden/)
  assert.match(css, /overflow-x:\s*hidden/)
  assert.match(css, /touch-action:\s*pan-y/)
  assert.match(css, /font-size:\s*16px\s*!important/)
  assert.match(css, /resize:\s*none/)

  assert.match(sw, /hrx-admin-v4/)
  assert.match(deploy, /user-scalable=no/)
  assert.match(deploy, /maximum-scale=1/)
  assert.match(deploy, /viewport-fit=cover/)

  assert.doesNotMatch(publicIndex, /user-scalable=no/)
})
