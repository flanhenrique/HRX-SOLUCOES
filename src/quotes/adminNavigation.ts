export type AdminDestination = 'executive' | 'quotes' | 'clients' | 'suspensions' | 'documents' | 'panels' | 'fiscal' | 'settings'

export const ADMIN_NAVIGATE_EVENT = 'hrx:admin-navigate'

export function navigateAdmin(destination: AdminDestination) {
  window.dispatchEvent(new CustomEvent<AdminDestination>(ADMIN_NAVIGATE_EVENT, { detail: destination }))

  if (destination === 'panels') {
    window.location.hash = '#admin/painels'
    return
  }

  if (window.location.hash === '#admin/painels') {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }
}

export function onAdminNavigate(handler: (destination: AdminDestination) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<AdminDestination>).detail)
  window.addEventListener(ADMIN_NAVIGATE_EVENT, listener)
  return () => window.removeEventListener(ADMIN_NAVIGATE_EVENT, listener)
}
