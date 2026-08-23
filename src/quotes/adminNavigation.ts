export type AdminDestination = 'executive' | 'quotes' | 'clients' | 'suspensions' | 'documents' | 'panels' | 'activities' | 'fiscal' | 'finance' | 'settings'

export const ADMIN_NAVIGATE_EVENT = 'hrx:admin-navigate'

export function navigateAdmin(destination: AdminDestination) {
  window.dispatchEvent(new CustomEvent<AdminDestination>(ADMIN_NAVIGATE_EVENT, { detail: destination }))
  const hashes: Partial<Record<AdminDestination, string>> = {
    executive: '#admin/visao-geral', panels: '#admin/painels', activities: '#admin/atividades',
    clients: '#admin/clientes', documents: '#admin/documentos', settings: '#admin/configuracoes',
    quotes: '#admin/orcamentos', suspensions: '#admin/suspensoes', fiscal: '#admin/fiscal', finance: '#admin/financeiro',
  }
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hashes[destination] ?? ''}`)
}

export function onAdminNavigate(handler: (destination: AdminDestination) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<AdminDestination>).detail)
  window.addEventListener(ADMIN_NAVIGATE_EVENT, listener)
  return () => window.removeEventListener(ADMIN_NAVIGATE_EVENT, listener)
}
