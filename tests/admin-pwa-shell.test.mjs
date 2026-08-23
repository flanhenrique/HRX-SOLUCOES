import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin PWA locks viewport, orientation and horizontal overflow', async () => {
  const [shell, legacyCss, unifiedCss, manifestText, sw, deploy, publicIndex] = await Promise.all([
    read('src/quotes/adminAppShell.ts'),
    read('src/quotes/app-shell.css'),
    read('src/quotes/admin-unified-shell.css'),
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
  assert.match(legacyCss, /html\.hrx-admin-pwa body[\s\S]*position:\s*fixed/)
  assert.match(unifiedCss, /html\.hrx-admin-pwa:has\(\.hrx-unified-shell\)[\s\S]*overflow:hidden!important/)
  assert.match(unifiedCss, /\.hrx-unified-shell\{[\s\S]*height:100dvh/)
  assert.match(unifiedCss, /\.hrx-unified-shell\.is-pwa>[\s\S]*padding-top:env\(safe-area-inset-top\)/)
  assert.match(unifiedCss, /overflow-x:hidden/)
  assert.match(sw, /hrx-admin-v4/)
  assert.match(deploy, /user-scalable=no/)
  assert.match(deploy, /maximum-scale=1/)
  assert.match(deploy, /viewport-fit=cover/)
  assert.doesNotMatch(publicIndex, /user-scalable=no/)
})

test('admin bootstrap recognizes project panel destinations', async () => {
  const main = await read('src/main.tsx')
  assert.match(main, /#admin\/orcamentos/)
  assert.match(main, /#admin\/painels/)
  assert.match(main, /pathname\.startsWith\('\/admin\/'\)/)
  assert.match(main, /configureAdminAppShell/)
})

test('authenticated admin changes password through hardened security helper inside the unified root', async () => {
  const [experience, security, adminApp, root, authRouter, main] = await Promise.all([
    read('src/quotes/AdminExperienceLayer.tsx'),
    read('src/quotes/passwordSecurity.ts'),
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/AdminAuthRouter.tsx'),
    read('src/main.tsx'),
  ])

  assert.match(experience, /secureUpdateAdminPassword\(password\)/)
  assert.match(experience, /Alterar senha/)
  assert.match(experience, /minLength=\{12\}/)
  assert.match(security, /admin-password/)
  assert.match(adminApp, /<AdminUnifiedRoot \/>/)
  assert.match(root, /<AdminExperienceLayer \/>/)
  assert.match(authRouter, /<AdminMfaGate session=\{session\}><AdminApp \/><\/AdminMfaGate>/)
  assert.doesNotMatch(main, /<AdminExperienceLayer \/>|<AdminPasswordControl \/>/)
})

test('first access is integrated into the login screen without email delivery', async () => {
  const [router, client, main] = await Promise.all([
    read('src/quotes/AdminAuthRouter.tsx'),
    read('src/quotes/supabaseClient.ts'),
    read('src/main.tsx'),
  ])

  assert.match(client, /admin-bootstrap/)
  assert.match(router, />Primeiro acesso</)
  assert.match(router, />Ativar acesso</)
  assert.match(router, /signInWithPassword/)
  assert.match(router, /code_already_used/)
  assert.match(router, /switchMode\('activate'\)/)
  assert.doesNotMatch(main, /<AdminBootstrapAccess \/>/)
})
