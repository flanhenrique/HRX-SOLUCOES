import { useEffect } from 'react'
import { onAdminNavigate } from './adminNavigation'

export default function AdminLegacyNavigationBridge() {
  useEffect(() => onAdminNavigate((destination) => {
    if (destination === 'fiscal') {
      document.querySelector<HTMLButtonElement>('.admin-fiscal-nav')?.click()
    }
  }), [])

  return null
}
