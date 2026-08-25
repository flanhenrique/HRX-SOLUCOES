import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('out-of-scope recovery page removes stale HRX Admin workers and caches before reopening admin', async () => {
  const page = await read('public/admin-recover.html')

  assert.match(page, /navigator\.serviceWorker\.getRegistrations\(\)/)
  assert.match(page, /scope\.pathname\.startsWith\('\/admin\/'\)/)
  assert.match(page, /registration\.unregister\(\)/)
  assert.match(page, /caches\.keys\(\)/)
  assert.match(page, /name\.startsWith\('hrx-admin-atomic-'\)/)
  assert.match(page, /name === 'hrx-admin-v3'/)
  assert.match(page, /name === 'hrx-admin-v4'/)
  assert.match(page, /new URL\('\/admin\/orcamentos', location\.origin\)/)
  assert.match(page, /hrx-recovered/)
  assert.match(page, /location\.replace\(target\.toString\(\)\)/)
})
