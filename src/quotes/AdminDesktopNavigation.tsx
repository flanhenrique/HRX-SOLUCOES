import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { navigateAdmin, type AdminDestination } from './adminNavigation'
import './admin-desktop-navigation.css'

const items: { destination: AdminDestination; icon: string; label: string }[] = [
  { destination: 'clients', icon: '♙', label: 'Clientes' },
  { destination: 'suspensions', icon: 'Ⅱ', label: 'Suspensões' },
  { destination: 'documents', icon: '▤', label: 'Central de documentos' },
  { destination: 'panels', icon: '▦', label: 'Painéis' },
  { destination: 'fiscal', icon: '◇', label: 'Fiscal' },
]

export default function AdminDesktopNavigation() {
  const [target, setTarget] = useState<Element | null>(null)

  useEffect(() => {
    const sync = () => setTarget(document.querySelector('.admin-exec-sidebar nav'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!target) return null

  return createPortal(<div className="hrx-admin-desktop-nav" aria-label="Áreas administrativas">
    <div className="hrx-admin-desktop-divider"><span>GESTÃO</span></div>
    {items.map((item) => <button key={item.destination} type="button" onClick={() => navigateAdmin(item.destination)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
  </div>, target)
}
