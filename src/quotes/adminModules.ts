import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

export type AdminDestination =
  | 'executive'
  | 'quotes'
  | 'clients'
  | 'finance'
  | 'fiscal'
  | 'suspensions'
  | 'activities'
  | 'documents'
  | 'panels'
  | 'settings'

export type AdminNavigationGroup = 'principal' | 'management' | 'governance'
export type AdminMobileNavigation = 'primary' | 'more'
export type AdminSubrouteId =
  | 'client-detail'
  | 'quote-detail'
  | 'quote-edit'
  | 'finance-receivable'
  | 'finance-payable'

export type AdminSubroute = {
  id: AdminSubrouteId
  pattern: string
  title: string
  shortTitle?: string
  breadcrumbTitle?: string
}

export type AdminModule = {
  id: AdminDestination
  path: `/admin${string}`
  title: string
  shortTitle?: string
  icon: string
  navigationGroup: AdminNavigationGroup
  desktopOrder: number
  mobileNavigation: AdminMobileNavigation
  mobileOrder: number
  permissions: readonly string[]
  component: LazyExoticComponent<ComponentType>
  subroutes?: readonly AdminSubroute[]
  legacyHashes?: readonly string[]
  legacyPaths?: readonly string[]
}

export type AdminBreadcrumb = {
  label: string
  path: string
}

export type AdminResolvedRoute = {
  module: AdminModule
  subroute: AdminSubroute | null
  pathname: string
  params: Readonly<Record<string, string>>
  title: string
  shortTitle: string
  breadcrumbs: readonly AdminBreadcrumb[]
}

export const ADMIN_MODULES: readonly AdminModule[] = [
  {
    id: 'executive',
    path: '/admin',
    title: 'Visão Geral',
    shortTitle: 'Início',
    icon: '⌂',
    navigationGroup: 'principal',
    desktopOrder: 10,
    mobileNavigation: 'primary',
    mobileOrder: 10,
    permissions: [],
    component: lazy(() => import('./AdminExecutiveDashboard')),
    legacyHashes: ['visao-geral', 'executive'],
    legacyPaths: ['/admin/visao-geral'],
  },
  {
    id: 'quotes',
    path: '/admin/orcamentos',
    title: 'Orçamentos',
    icon: '◫',
    navigationGroup: 'principal',
    desktopOrder: 20,
    mobileNavigation: 'primary',
    mobileOrder: 20,
    permissions: [],
    component: lazy(() => import('./AdminQuotes')),
    subroutes: [
      { id: 'quote-edit', pattern: ':orcamentoId/editar', title: 'Editar orçamento', breadcrumbTitle: 'Editar' },
      { id: 'quote-detail', pattern: ':orcamentoId', title: 'Orçamento', breadcrumbTitle: 'Detalhe' },
    ],
    legacyHashes: ['orcamentos', 'quotes'],
  },
  {
    id: 'clients',
    path: '/admin/clientes',
    title: 'Clientes',
    icon: '♙',
    navigationGroup: 'principal',
    desktopOrder: 30,
    mobileNavigation: 'primary',
    mobileOrder: 30,
    permissions: [],
    component: lazy(() => import('./AdminClientsPage')),
    subroutes: [
      { id: 'client-detail', pattern: ':clienteId', title: 'Cliente', breadcrumbTitle: 'Detalhe' },
    ],
    legacyHashes: ['clientes', 'clients'],
  },
  {
    id: 'finance',
    path: '/admin/financeiro',
    title: 'Financeiro',
    icon: '¤',
    navigationGroup: 'management',
    desktopOrder: 40,
    mobileNavigation: 'primary',
    mobileOrder: 40,
    permissions: [],
    component: lazy(() => import('./AdminFinanceScopedPage')),
    subroutes: [
      { id: 'finance-receivable', pattern: 'receber', title: 'Contas a receber', shortTitle: 'A receber', breadcrumbTitle: 'A receber' },
      { id: 'finance-payable', pattern: 'pagar', title: 'Contas a pagar', shortTitle: 'A pagar', breadcrumbTitle: 'A pagar' },
    ],
    legacyHashes: ['financeiro', 'finance'],
  },
  {
    id: 'fiscal',
    path: '/admin/fiscal',
    title: 'Fiscal',
    icon: '§',
    navigationGroup: 'management',
    desktopOrder: 50,
    mobileNavigation: 'more',
    mobileOrder: 30,
    permissions: [],
    component: lazy(() => import('./AdminFiscalPage')),
    legacyHashes: ['fiscal'],
  },
  {
    id: 'suspensions',
    path: '/admin/suspensoes',
    title: 'Suspensões',
    icon: 'Ⅱ',
    navigationGroup: 'management',
    desktopOrder: 60,
    mobileNavigation: 'more',
    mobileOrder: 50,
    permissions: [],
    component: lazy(() => import('./AdminSuspensionsPage')),
    legacyHashes: ['suspensoes', 'suspensions'],
  },
  {
    id: 'activities',
    path: '/admin/atividades',
    title: 'Atividades',
    icon: '✓',
    navigationGroup: 'management',
    desktopOrder: 70,
    mobileNavigation: 'more',
    mobileOrder: 20,
    permissions: [],
    component: lazy(() => import('./AdminActivitiesPage')),
    legacyHashes: ['atividades', 'activities'],
  },
  {
    id: 'documents',
    path: '/admin/documentos',
    title: 'Central de Documentos',
    shortTitle: 'Documentos',
    icon: '▤',
    navigationGroup: 'governance',
    desktopOrder: 80,
    mobileNavigation: 'more',
    mobileOrder: 40,
    permissions: [],
    component: lazy(() => import('./AdminDocumentsPage')),
    legacyHashes: ['documentos', 'documents'],
  },
  {
    id: 'panels',
    path: '/admin/paineis',
    title: 'Painéis',
    icon: '▣',
    navigationGroup: 'governance',
    desktopOrder: 90,
    mobileNavigation: 'more',
    mobileOrder: 10,
    permissions: [],
    component: lazy(() => import('./AdminProjectPanelsPage')),
    legacyHashes: ['paineis', 'painels', 'projetos', 'panels'],
    legacyPaths: ['/admin/painels', '/admin/projetos'],
  },
  {
    id: 'settings',
    path: '/admin/configuracoes',
    title: 'Configurações',
    shortTitle: 'Configurações',
    icon: '⚙',
    navigationGroup: 'governance',
    desktopOrder: 100,
    mobileNavigation: 'more',
    mobileOrder: 60,
    permissions: [],
    component: lazy(() => import('./AdminSettingsPage')),
    legacyHashes: ['configuracoes', 'settings'],
  },
]

const modulesById = new Map<AdminDestination, AdminModule>(ADMIN_MODULES.map((module) => [module.id, module]))

export const ADMIN_DESKTOP_MODULES = [...ADMIN_MODULES].sort((left, right) => left.desktopOrder - right.desktopOrder)
export const ADMIN_MOBILE_PRIMARY_MODULES = ADMIN_MODULES
  .filter((module) => module.mobileNavigation === 'primary')
  .sort((left, right) => left.mobileOrder - right.mobileOrder)
export const ADMIN_MOBILE_MORE_MODULES = ADMIN_MODULES
  .filter((module) => module.mobileNavigation === 'more')
  .sort((left, right) => left.mobileOrder - right.mobileOrder)

export function getAdminModule(destination: AdminDestination): AdminModule {
  return modulesById.get(destination) ?? modulesById.get('executive')!
}

export function normalizeAdminPath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function moduleMatchesPath(module: AdminModule, pathname: string): boolean {
  if (module.path === pathname) return true
  return module.legacyPaths?.includes(pathname) ?? false
}

function moduleMatchesSubroute(module: AdminModule, pathname: string): boolean {
  if (module.path !== '/admin' && pathname.startsWith(`${module.path}/`)) return true
  return module.legacyPaths?.some((legacyPath) => pathname.startsWith(`${legacyPath}/`)) ?? false
}

export function resolveAdminModuleFromPath(pathname: string): AdminModule | null {
  const normalized = normalizeAdminPath(pathname)
  const exact = ADMIN_MODULES.find((module) => moduleMatchesPath(module, normalized))
  if (exact) return exact

  return [...ADMIN_MODULES]
    .filter((module) => module.path !== '/admin')
    .sort((left, right) => right.path.length - left.path.length)
    .find((module) => moduleMatchesSubroute(module, normalized)) ?? null
}

function decodeRouteParam(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}

function matchSubroute(pattern: string, relativePath: string): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter(Boolean)
  const pathSegments = relativePath.split('/').filter(Boolean)
  if (patternSegments.length !== pathSegments.length) return null

  const params: Record<string, string> = {}
  for (let index = 0; index < patternSegments.length; index += 1) {
    const expected = patternSegments[index]
    const actual = pathSegments[index]
    if (expected.startsWith(':')) {
      if (!actual) return null
      params[expected.slice(1)] = decodeRouteParam(actual)
      continue
    }
    if (expected !== actual) return null
  }
  return params
}

function canonicalRelativePath(module: AdminModule, pathname: string): string | null {
  if (pathname === module.path) return ''
  if (pathname.startsWith(`${module.path}/`)) return pathname.slice(module.path.length + 1)
  return null
}

export function resolveAdminRouteFromPath(pathname: string): AdminResolvedRoute | null {
  const normalized = normalizeAdminPath(pathname)
  const module = resolveAdminModuleFromPath(normalized)
  if (!module) return null

  const relativePath = canonicalRelativePath(module, normalized)
  let subroute: AdminSubroute | null = null
  let params: Record<string, string> = {}

  if (relativePath) {
    for (const candidate of module.subroutes ?? []) {
      const matched = matchSubroute(candidate.pattern, relativePath)
      if (!matched) continue
      subroute = candidate
      params = matched
      break
    }
  }

  const title = subroute?.title ?? module.title
  const shortTitle = subroute?.shortTitle ?? subroute?.title ?? module.shortTitle ?? module.title
  const breadcrumbs: AdminBreadcrumb[] = [{ label: module.title, path: module.path }]
  if (subroute) breadcrumbs.push({ label: subroute.breadcrumbTitle ?? subroute.title, path: normalized })

  return { module, subroute, pathname: normalized, params, title, shortTitle, breadcrumbs }
}

export function buildAdminSubroutePath(destination: AdminDestination, subrouteId: AdminSubrouteId, params: Record<string, string>): string {
  const module = getAdminModule(destination)
  const subroute = module.subroutes?.find((candidate) => candidate.id === subrouteId)
  if (!subroute) throw new Error(`admin_subroute_not_found:${destination}:${subrouteId}`)

  const relative = subroute.pattern.split('/').map((segment) => {
    if (!segment.startsWith(':')) return segment
    const key = segment.slice(1)
    const value = params[key]
    if (!value) throw new Error(`admin_subroute_param_required:${key}`)
    return encodeURIComponent(value)
  }).join('/')

  return `${module.path}/${relative}`
}

export function resolveAdminModuleFromLegacyHash(hash: string): AdminModule | null {
  const raw = hash.replace(/^#/, '')
  if (!raw.startsWith('admin/')) return null
  const key = raw.slice('admin/'.length).replace(/^\/+|\/+$/g, '').split(/[?#]/, 1)[0]
  if (!key) return getAdminModule('executive')

  return ADMIN_MODULES.find((module) => module.legacyHashes?.includes(key)) ?? null
}
