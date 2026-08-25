import {
  getAdminModule,
  normalizeAdminPath,
  resolveAdminModuleFromLegacyHash,
  resolveAdminModuleFromPath,
  resolveAdminRouteFromPath,
  type AdminDestination,
  type AdminResolvedRoute,
} from './adminModules'

export type { AdminDestination } from './adminModules'

export const ADMIN_NAVIGATE_EVENT = 'hrx:admin-navigate'

function fallbackAdminRoute(): AdminResolvedRoute {
  return resolveAdminRouteFromPath('/admin')!
}

export function resolveAdminRoute(): AdminResolvedRoute {
  const legacyHashModule = resolveAdminModuleFromLegacyHash(window.location.hash)
  if (legacyHashModule) return resolveAdminRouteFromPath(legacyHashModule.path) ?? fallbackAdminRoute()

  return resolveAdminRouteFromPath(window.location.pathname) ?? fallbackAdminRoute()
}

export function resolveAdminDestination(): AdminDestination {
  return resolveAdminRoute().module.id
}

function canonicalAdminUrl(destination: AdminDestination): string {
  const module = getAdminModule(destination)
  return `${module.path}${window.location.search}`
}

function canonicalAdminPathUrl(pathname: string): string {
  return `${normalizeAdminPath(pathname)}${window.location.search}`
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

function isCanonicalAdminPath(pathname: string): boolean {
  const normalized = normalizeAdminPath(pathname)
  const module = resolveAdminModuleFromPath(normalized)
  if (!module) return false
  return normalized === module.path || (module.path !== '/admin' && normalized.startsWith(`${module.path}/`))
}

function dispatchAdminNavigation(destination: AdminDestination) {
  window.dispatchEvent(new CustomEvent<AdminDestination>(ADMIN_NAVIGATE_EVENT, { detail: destination }))
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

  dispatchAdminNavigation(destination)
}

export function navigateAdminPath(pathname: string, options: { replace?: boolean } = {}) {
  const normalized = normalizeAdminPath(pathname)
  if (!isCanonicalAdminPath(normalized)) throw new Error(`invalid_admin_path:${pathname}`)

  const route = resolveAdminRouteFromPath(normalized)
  if (!route) throw new Error(`unresolved_admin_path:${pathname}`)

  const nextUrl = canonicalAdminPathUrl(normalized)
  const currentUrl = currentAdminUrl()
  if (nextUrl !== currentUrl) {
    const state = { hrxAdmin: route.module.id, hrxAdminPath: normalized }
    if (options.replace) history.replaceState(state, '', nextUrl)
    else history.pushState(state, '', nextUrl)
  }

  dispatchAdminNavigation(route.module.id)
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

export function onAdminRouteChange(handler: (route: AdminResolvedRoute) => void) {
  const sync = () => {
    const route = resolveAdminRoute()
    canonicalizeAdminLocation(route.module.id)
    handler(resolveAdminRoute())
  }

  window.addEventListener(ADMIN_NAVIGATE_EVENT, sync)
  window.addEventListener('popstate', sync)
  window.addEventListener('hashchange', sync)

  return () => {
    window.removeEventListener(ADMIN_NAVIGATE_EVENT, sync)
    window.removeEventListener('popstate', sync)
    window.removeEventListener('hashchange', sync)
  }
}
