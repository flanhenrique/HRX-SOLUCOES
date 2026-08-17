const BUILD = '__HRX_ADMIN_BUILD__'
const CACHE_NAME = `hrx-admin-atomic-${BUILD}`
const CACHE_PREFIX = 'hrx-admin-atomic-'
const LEGACY_CACHE_NAMES = new Set(['hrx-admin-v3', 'hrx-admin-v4'])
const ADMIN_ROUTE = '/admin/orcamentos'
const VERSION_URL = '/admin/version.json'
const CORE_ASSETS = ['/admin/manifest.webmanifest', '/admin/hrx-admin-icon.svg', VERSION_URL]

self.addEventListener('install', (event) => { event.waitUntil(cacheApplicationShell()) })

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  clients.forEach((client) => client.postMessage(message))
}
async function fetchFresh(url) { return fetch(url, { cache: 'no-store' }) }
async function cacheApplicationShell() {
  const cache = await caches.open(CACHE_NAME)
  await notifyClients({ type: 'HRX_UPDATE_PROGRESS', phase: 'download', progress: 12, completed: 0, total: 1 })
  const shellResponse = await fetchFresh(ADMIN_ROUTE)
  if (!shellResponse.ok) throw new Error(`admin_shell_${shellResponse.status}`)
  const shellText = await shellResponse.clone().text()
  await cache.put(ADMIN_ROUTE, shellResponse)
  const discoveredAssets = [...shellText.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .map((value) => { try { return new URL(value, self.location.origin) } catch { return null } })
    .filter((url) => url && url.origin === self.location.origin)
    .filter((url) => url.pathname.startsWith('/assets/') || url.pathname.startsWith('/admin/'))
    .map((url) => `${url.pathname}${url.search}`)
  const assets = [...new Set([...CORE_ASSETS, ...discoveredAssets])]
  const total = assets.length + 1
  let completed = 1
  for (const asset of assets) {
    if (asset === ADMIN_ROUTE) continue
    const response = await fetchFresh(asset)
    if (!response.ok) throw new Error(`asset_${response.status}_${asset}`)
    await cache.put(asset, response)
    completed += 1
    await notifyClients({ type: 'HRX_UPDATE_PROGRESS', phase: 'download', progress: 12 + Math.round((completed / total) * 58), completed, total })
  }
  await notifyClients({ type: 'HRX_UPDATE_PROGRESS', phase: 'install', progress: 74, completed, total })
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => (name.startsWith(CACHE_PREFIX) || LEGACY_CACHE_NAMES.has(name)) && name !== CACHE_NAME).map((name) => caches.delete(name)))
    await notifyClients({ type: 'HRX_UPDATE_PROGRESS', phase: 'install', progress: 92 })
    await self.clients.claim()
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    clients.forEach((client) => {
      client.postMessage({ type: 'HRX_UPDATE_PROGRESS', phase: 'complete', progress: 100 })
      client.postMessage({ type: 'HRX_UPDATED', build: BUILD })
    })
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === VERSION_URL) return
  if (request.mode === 'navigate') {
    if (!url.pathname.startsWith('/admin/')) return
    event.respondWith(navigationResponse(request, event))
    return
  }
  const cacheableDestination = ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)
  const cacheablePath = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/admin/')
  if (cacheableDestination && cacheablePath) event.respondWith(assetResponse(request, event))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data?.type === 'CLEAR_HRX_ADMIN_CACHE') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) || LEGACY_CACHE_NAMES.has(name)).map((name) => caches.delete(name)))))
  }
})

async function navigationResponse(request, event) {
  try {
    const response = await fetch(request, { cache: 'no-store' })
    if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(ADMIN_ROUTE, response.clone())))
    return response
  } catch {
    const cache = await caches.open(CACHE_NAME)
    return (await cache.match(ADMIN_ROUTE)) || Response.error()
  }
}
async function assetResponse(request, event) {
  try {
    const response = await fetch(request, { cache: 'no-store' })
    if (!response.ok) return response
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())))
    return response
  } catch {
    const cache = await caches.open(CACHE_NAME)
    return (await cache.match(request)) || Response.error()
  }
}
