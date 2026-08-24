export type AdminDestination = 'executive' | 'quotes' | 'clients' | 'suspensions' | 'documents' | 'panels' | 'activities' | 'fiscal' | 'finance' | 'settings'

export const ADMIN_NAVIGATE_EVENT = 'hrx:admin-navigate'

const hashes: Record<AdminDestination, string> = {
  executive: '#admin/visao-geral',
  panels: '#admin/painels',
  activities: '#admin/atividades',
  clients: '#admin/clientes',
  documents: '#admin/documentos',
  settings: '#admin/configuracoes',
  quotes: '#admin/orcamentos',
  suspensions: '#admin/suspensoes',
  fiscal: '#admin/fiscal',
  finance: '#admin/financeiro',
}

const hashDestinations: Record<string, AdminDestination> = {
  'visao-geral': 'executive',
  paineis: 'panels',
  atividades: 'activities',
  clientes: 'clients',
  documentos: 'documents',
  configuracoes: 'settings',
  orcamentos: 'quotes',
  suspensoes: 'suspensions',
  fiscal: 'fiscal',
  financeiro: 'finance',
}

const pathDestinations: Record<string, AdminDestination> = {
  '/admin': 'executive',
  '/admin/visao-geral': 'executive',
  '/admin/paineis': 'panels',
  '/admin/atividades': 'activities',
  '/admin/clientes': 'clients',
  '/admin/documentos': 'documents',
  '/admin/configuracoes': 'settings',
  '/admin/orcamentos': 'quotes',
  '/admin/suspensoes': 'suspensions',
  '/admin/fiscal': 'fiscal',
  '/admin/financeiro': 'finance',
}

export function resolveAdminDestination(): AdminDestination {
  const hash = window.location.hash.replace(/^#admin\//, '').replace(/\/+$/, '')
  if (hashDestinations[hash]) return hashDestinations[hash]

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  return pathDestinations[pathname] ?? 'executive'
}

export function navigateAdmin(destination: AdminDestination, options: { replace?: boolean } = {}) {
  const nextUrl = `${window.location.pathname}${window.location.search}${hashes[destination]}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

  if (nextUrl !== currentUrl) {
    if (options.replace) history.replaceState({ hrxAdmin: destination }, '', nextUrl)
    else history.pushState({ hrxAdmin: destination }, '', nextUrl)
  }

  window.dispatchEvent(new CustomEvent<AdminDestination>(ADMIN_NAVIGATE_EVENT, { detail: destination }))
}

export function onAdminNavigate(handler: (destination: AdminDestination) => void) {
  const onNavigate = (event: Event) => handler((event as CustomEvent<AdminDestination>).detail)
  const onHistory = () => handler(resolveAdminDestination())

  window.addEventListener(ADMIN_NAVIGATE_EVENT, onNavigate)
  window.addEventListener('popstate', onHistory)
  window.addEventListener('hashchange', onHistory)

  return () => {
    window.removeEventListener(ADMIN_NAVIGATE_EVENT, onNavigate)
    window.removeEventListener('popstate', onHistory)
    window.removeEventListener('hashchange', onHistory)
  }
}
