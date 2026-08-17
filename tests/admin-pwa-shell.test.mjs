import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin PWA locks viewport and implements atomic updates', async () => {
  const [shell, css, manifestText, sw, deploy, publicIndex, bridge, versionText] = await Promise.all([
    read('src/quotes/adminAppShell.ts'),
    read('src/quotes/app-shell.css'),
    read('public/admin/manifest.webmanifest'),
    read('public/admin/sw.js'),
    read('.github/workflows/deploy-pages.yml'),
    read('index.html'),
    read('src/AdminPwaBridge.tsx'),
    read('public/admin/version.json'),
  ])
  const manifest = JSON.parse(manifestText)
  const version = JSON.parse(versionText)

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

  assert.match(sw, /hrx-admin-atomic-/)
  assert.match(sw, /__HRX_ADMIN_BUILD__/)
  assert.match(sw, /HRX_UPDATE_PROGRESS/)
  assert.match(sw, /SKIP_WAITING/)
  assert.match(sw, /cacheApplicationShell/)
  assert.match(sw, /url\.origin !== self\.location\.origin/)
  assert.match(bridge, /registration\.update\(\)/)
  assert.match(bridge, /controllerchange/)
  assert.match(bridge, /\/admin\/version\.json/)
  assert.match(bridge, /Atualizar agora/)
  assert.match(bridge, /Atualização completa/)
  assert.match(bridge, /setAppBadge/)

  assert.equal(version.build, 'dev')
  assert.match(deploy, /__HRX_ADMIN_BUILD__/)
  assert.match(deploy, /GITHUB_RUN_NUMBER/)
  assert.match(deploy, /user-scalable=no/)
  assert.match(deploy, /maximum-scale=1/)
  assert.match(deploy, /viewport-fit=cover/)
  assert.doesNotMatch(publicIndex, /user-scalable=no/)
})
