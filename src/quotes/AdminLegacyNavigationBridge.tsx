import { useEffect } from 'react'
import { onAdminNavigate } from './adminNavigation'

export default function AdminLegacyNavigationBridge() {
  useEffect(() => onAdminNavigate((destination) => {
    if (destination === 'quotes') {
      document.querySelector<HTMLButtonElement>('.admin-ops-header button[aria-label="Fechar"]')?.click()
      return
    }

    if (destination === 'clients' || destination === 'suspensions') {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.admin-ops-nav'))
      buttons[destination === 'clients' ? 0 : 1]?.click()
      return
    }

    if (destination === 'fiscal') {
      document.querySelector<HTMLButtonElement>('.admin-fiscal-nav')?.click()
    }
  }), [])

  return null
}
