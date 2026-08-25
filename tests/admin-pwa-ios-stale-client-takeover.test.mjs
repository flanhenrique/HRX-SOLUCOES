import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('service worker replaces an iOS standalone client that is stuck on an old bundle', async () => {
  const sw = await read('public/admin/sw.js')

  assert.match(sw, /FORCE_IOS_STALE_CLIENT_TAKEOVER = true/)
  assert.match(sw, /await cacheApplicationShell\(\)[\s\S]*self\.skipWaiting\(\)/)
  assert.match(sw, /await self\.clients\.claim\(\)/)
  assert.match(sw, /function refreshAdminClients\(clients\)/)
  assert.match(sw, /url\.pathname\.startsWith\('\/admin\/'\)/)
  assert.match(sw, /await client\.navigate\(client\.url\)/)
  assert.match(sw, /await refreshAdminClients\(clients\)/)

  // A navegação só acontece depois do pacote novo estar em cache e da limpeza
  // dos caches antigos, evitando misturar HTML/CSS/JS de releases diferentes.
  assert.ok(sw.indexOf('await cacheApplicationShell()') < sw.indexOf('await self.skipWaiting()'))
  assert.ok(sw.indexOf('caches.delete(name)') < sw.indexOf('await self.clients.claim()'))
  assert.ok(sw.indexOf('await self.clients.claim()') < sw.indexOf('await refreshAdminClients(clients)'))
})
