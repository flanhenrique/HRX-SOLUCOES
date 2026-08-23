import test from 'node:test'
import assert from 'node:assert/strict'

const ORIGIN = 'https://hrxsolutions.com.br'

async function get(path) {
  const response = await fetch(`${ORIGIN}${path}`, {
    headers: { 'user-agent': 'HRX-PWA-Production-Smoke/2026-08-23' },
    redirect: 'follow',
  })
  assert.equal(response.ok, true, `${path} respondeu HTTP ${response.status}`)
  return response
}

test('production serves the hardened HRX Admin PWA release', async () => {
  const manifest = await (await get('/admin/manifest.webmanifest')).json()
  assert.equal(manifest.lang, 'pt-BR')
  assert.equal(manifest.orientation, undefined)
  assert.ok(manifest.icons?.some((icon) => icon.purpose === 'maskable' && icon.src === '/admin/hrx-admin-icon-maskable.svg'))

  const version = await (await get('/admin/version.json')).json()
  assert.notEqual(String(version.build || '').trim(), '')
  assert.notEqual(String(version.build || '').trim(), 'dev')

  const adminHtml = await (await get('/admin/orcamentos')).text()
  assert.match(adminHtml, /width=device-width, initial-scale=1, viewport-fit=cover/)
  assert.doesNotMatch(adminHtml, /user-scalable=no/)
  assert.doesNotMatch(adminHtml, /maximum-scale=1/)
  assert.match(adminHtml, /__HRX_ADMIN_BUILD__/)

  const sw = await (await get('/admin/sw.js')).text()
  assert.match(sw, /RUNTIME_FETCH_TIMEOUT_MS/)
  assert.match(sw, /INSTALL_CONCURRENCY/)
  assert.match(sw, /hrx-admin-icon-maskable\.svg/)
  assert.doesNotMatch(sw, /__HRX_ADMIN_BUILD__/)
})
