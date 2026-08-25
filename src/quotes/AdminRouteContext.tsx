import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { AdminResolvedRoute } from './adminModules'

const AdminRouteContext = createContext<AdminResolvedRoute | null>(null)

export function AdminRouteProvider({ route, children }: { route: AdminResolvedRoute; children: ReactNode }) {
  return <AdminRouteContext.Provider value={route}>{children}</AdminRouteContext.Provider>
}

export function useAdminRoute(): AdminResolvedRoute {
  const route = useContext(AdminRouteContext)
  if (!route) throw new Error('useAdminRoute must be used inside AdminRouteProvider')
  return route
}
