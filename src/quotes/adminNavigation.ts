import {
  getAdminModule,
  normalizeAdminPath,
  resolveAdminModuleFromLegacyHash,
  resolveAdminModuleFromPath,
  type AdminDestination,
} from './adminModules'

export type { AdminDestination } from './adminModules'

export const ADMIN_NAVIGATE_EVENT = 'hrx:admin-navigate'

export function resolveAdminDestination(): AdminDestination {
  const legacyHashModule = resolveAdminModuleFromLegacyHash(window.location.hash)
  if (legacyHashModule) return legacyHashModule.id

  return resolveAdminModuleFromPath(window.location.pathname)?.id ?? 'executive'
}

function canonicalAdminUrl(destination: AdminDestination): string {
  const module = getAdminModule(destination)
  return `${module.path}${window.location.search}`
}

function currentAdminUrl(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function isCanonicalPathFor(destination: AdminDestination): boolean {
  const pathname = normalizeAdminPath(window.location.pathname)
  const module = getAdminModule(destination)
  if (pathname === module.path) return true
  return module.path !== '/admin' && pathname.startsWith(`${module.path}/`)
}

export function canonicalizeAdminLocation(destination: AdminDestination = resolveAdminDestination()): boolean {
  const hasLegacyHash = Boolean(resolveAdminModuleFromLegacyHash(window.location.hash))
  if (!hasLegacyHash && isCanonicalPathFor(destination)) return false

  const nextUrl = canonicalAdminUrl(destination)
  if (nextUrl !== currentAdminUrl()) history.replaceState({ hrxAdmin: destination }, '', nextUrl)
  return true
}

export function navigateAdmin(destination: AdminDestination, options: { replace?: boolean } = {}) {
  const nextUrl = canonicalAdminUrl(destination)
  const currentUrl = currentAdminUrl()

  if (nextUrl !== currentUrl) {
    if (options.replace) history.replaceState({ hrxAdmin: destination }, '', nextUrl)
    else history.pushState({ hrxAdmin: destination }, '', nextUrl)
  }

  window.dispatchEvent(new CustomEvent<AdminDestination>(ADMIN_NAVIGATE_EVENT, { detail: destination }))
}

export function onAdminNavigate(handler: (destination: AdminDestination) => void) {
  const onNavigate = (event: Event) => handler((event as CustomEvent<AdminDestination>).detail)
  const onHistory = () => {
    const destination = resolveAdminDestination()
    canonicalizeAdminLocation(destination)
    handler(destination)
  }

  window.addEventListener(ADMIN_NAVIGATE_EVENT, onNavigate)
  window.addEventListener('popstate', onHistory)
  window.addEventListener('hashchange', onHistory)

  return () => {
    window.removeEventListener(ADMIN_NAVIGATE_EVENT, onNavigate)
    window.removeEventListener('popstate', onHistory)
    window.removeEventListener('hashchange', onHistory)
  }
}
