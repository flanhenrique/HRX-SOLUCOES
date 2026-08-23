import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('HRX Admin uses explicit atomic PWA updates without caching admin data', async () => {
  const [updater, service, sw, deploy, main, versionText] = await Promise.all([
    read('src/AdminPwaUpdater.tsx'),
    read('src/adminPwaService.ts'),
    read('public/admin/sw.js'),
    read('.github/workflows/deploy-pages.yml'),
    read('src/main.tsx'),
    read('public/admin/version.json'),
  ])
  const version = JSON.parse(versionText)

  assert.match(main, /AdminPwaUpdater/)
  assert.match(updater, /\/admin\/version\.json/)
  assert.match(updater, /registration\.update\(\)/)
  assert.match(updater, /controllerchange/)
  assert.match(updater, /SKIP_WAITING/)
  assert.match(updater, /Atualizar agora/)
  assert.match(updater, /Tentar novamente/)
  assert.match(updater, /Atualização completa/)
  assert.match(updater, /worker_redundant/)
  assert.match(updater, /UpdateState = 'idle' \| 'available' \| 'checking' \| 'downloading' \| 'installing' \| 'activating' \| 'complete' \| 'error'/)
  assert.match(updater, /finishAndReload\(\)/)
  assert.match(updater, /handleControllerChange/)
  assert.match(updater, /setAppBadge/)
  assert.match(updater, /cache:\s*'no-store'/)
  assert.doesNotMatch(updater, /catch\s*\{[\s\S]{0,180}finishAndReload\(\)/)

  assert.match(service, /serviceWorker\.register/)
  assert.match(service, /registrationPromise/)

  assert.match(sw, /hrx-admin-atomic-/)
  assert.match(sw, /__HRX_ADMIN_BUILD__/)
  assert.match(sw, /HRX_UPDATE_PROGRESS/)
  assert.match(sw, /HRX_UPDATED/)
  assert.match(sw, /SKIP_WAITING/)
  assert.match(sw, /AbortController/)
  assert.match(sw, /RUNTIME_FETCH_TIMEOUT_MS/)
  assert.match(sw, /INSTALL_CONCURRENCY/)
  assert.match(sw, /url\.origin !== self\.location\.origin/)
  assert.doesNotMatch(sw, /supabase\.co/)
  assert.doesNotMatch(sw, /quote_requests|quote_drafts|quote_items|auth\/v1/)

  assert.equal(version.build, 'dev')
  assert.match(deploy, /GITHUB_RUN_NUMBER/)
  assert.match(deploy, /__HRX_ADMIN_BUILD__/)
  assert.match(deploy, /globalThis\.__HRX_ADMIN_BUILD__/)
})
