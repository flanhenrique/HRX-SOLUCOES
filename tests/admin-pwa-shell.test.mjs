import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin PWA locks zoom only in standalone while browser mode stays accessible', async () => {
  const [shell, legacyCss, unifiedCss, manifestText, sw, deploy, publicIndex, bridge, service] = await Promise.all([
    read('src/quotes/adminAppShell.ts'),
    read('src/quotes/app-shell.css'),
    read('src/quotes/admin-unified-shell.css'),
    read('public/admin/manifest.webmanifest'),
    read('public/admin/sw.js'),
    read('.github/workflows/deploy-pages.yml'),
    read('index.html'),
    read('src/AdminPwaBridge.tsx'),
    read('src/adminPwaService.ts'),
  ])
  const manifest = JSON.parse(manifestText)

  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.orientation, undefined)
  assert.equal(manifest.start_url, '/admin/')
  assert.match(shell, /BROWSER_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover'/)
  assert.match(shell, /STANDALONE_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'/)
  assert.match(shell, /display-mode: standalone/)
  assert.match(shell, /navigator as Navigator & \{ standalone\?: boolean \}/)
  assert.match(shell, /standalone \? STANDALONE_VIEWPORT : BROWSER_VIEWPORT/)
  assert.match(shell, /hrxViewportPolicy/)
  assert.doesNotMatch(shell, /gesturestart|gesturechange|gestureend/)
  assert.doesNotMatch(shell, /event\.ctrlKey|event\.metaKey/)
  assert.match(legacyCss, /html\.hrx-admin-pwa body[\s\S]*position:\s*fixed/)
  assert.match(unifiedCss, /html\.hrx-admin-pwa:has\(\.hrx-unified-shell\)[\s\S]*overflow:hidden!important/)
  assert.match(unifiedCss, /\.hrx-unified-shell\{[\s\S]*position:fixed;[\s\S]*inset:0;[\s\S]*height:auto;/)
  assert.doesNotMatch(unifiedCss, /\.hrx-unified-shell\{[^}]*100dvh/)
  assert.match(unifiedCss, /--hrx-safe-top:env\(safe-area-inset-top,0px\)/)
  assert.match(unifiedCss, /\.hrx-unified-shell\.is-pwa>\.hrx-unified-content\{[\s\S]*overflow-y:auto;[\s\S]*overflow-x:hidden;/)
  assert.match(sw, /AbortController/)
  assert.match(sw, /INSTALL_CONCURRENCY/)
  assert.doesNotMatch(deploy, /user-scalable=no/)
  assert.doesNotMatch(deploy, /maximum-scale=1/)
  assert.match(deploy, /width=device-width, initial-scale=1, viewport-fit=cover/)
  assert.match(deploy, /dist\/admin\/index\.html/)
  assert.doesNotMatch(publicIndex, /user-scalable=no/)
  assert.doesNotMatch(bridge, /serviceWorker\.register/)
  assert.match(service, /ensureAdminServiceWorker/)
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'))
})

test('admin bootstrap recognizes canonical admin paths and legacy panel hashes', async () => {
  const main = await read('src/main.tsx')
  assert.match(main, /#admin\/orcamentos/)
  assert.match(main, /#admin\/painels/)
  assert.match(main, /pathname === '\/admin'/)
  assert.match(main, /pathname\.startsWith\('\/admin\/'\)/)
  assert.match(main, /configureAdminAppShell/)
})

test('authenticated admin changes password through hardened security helper inside the canonical settings view', async () => {
  const [settings, security, adminApp, root, modules, authRouter, main] = await Promise.all([
    read('src/quotes/AdminSettingsPage.tsx'),
    read('src/quotes/passwordSecurity.ts'),
    read('src/quotes/AdminApp.tsx'),
    read('src/quotes/AdminUnifiedRoot.tsx'),
    read('src/quotes/adminModules.ts'),
    read('src/quotes/AdminAuthRouter.tsx'),
    read('src/main.tsx'),
  ])

  assert.match(settings, /secureUpdateAdminPassword\(password\)/)
  assert.match(settings, /Alterar senha/)
  assert.match(settings, /minLength=\{12\}/)
  assert.match(security, /admin-password/)
  assert.match(adminApp, /<AdminUnifiedRoot \/>/)
  assert.match(root, /getAdminModule\(destination\)/)
  assert.match(modules, /component: lazy\(\(\) => import\('\.\/AdminSettingsPage'\)\)/)
  assert.match(modules, /path: '\/admin\/configuracoes'/)
  assert.doesNotMatch(root, /AdminExperienceLayer/)
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
