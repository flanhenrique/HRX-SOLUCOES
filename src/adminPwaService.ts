export const ADMIN_SERVICE_WORKER_URL = '/admin/sw.js'
export const ADMIN_SERVICE_WORKER_SCOPE = '/admin/'

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null

export function canUseAdminServiceWorker() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

export async function ensureAdminServiceWorker() {
  if (!canUseAdminServiceWorker()) throw new Error('service_worker_unavailable')

  registrationPromise ||= (async () => {
    const existing = await navigator.serviceWorker.getRegistration(ADMIN_SERVICE_WORKER_SCOPE)
    if (existing) return existing
    return navigator.serviceWorker.register(ADMIN_SERVICE_WORKER_URL, { scope: ADMIN_SERVICE_WORKER_SCOPE })
  })().catch((error) => {
    registrationPromise = null
    throw error
  })

  return registrationPromise
}

export async function checkAdminServiceWorkerUpdate() {
  const registration = await ensureAdminServiceWorker()
  await registration.update()
  return registration
}
