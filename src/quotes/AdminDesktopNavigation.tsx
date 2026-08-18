import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { navigateAdmin, onAdminNavigate, type AdminDestination } from './adminNavigation'
import './admin-desktop-navigation.css'

const items: { destination: AdminDestination; icon: string; label: string }[] = [
  { destination: 'executive', icon: '◫', label: 'Visão executiva' },
  { destination: 'quotes', icon: '▦', label: 'Orçamentos' },
  { destination: 'clients', icon: '♙', label: 'Clientes' },
  { destination: 'suspensions', icon: 'Ⅱ', label: 'Suspensões' },
  { destination: 'documents', icon: '▤', label: 'Central de documentos' },
  { destination: 'panels', icon: '▦', label: 'Painéis' },
  { destination: 'fiscal', icon: '◇', label: 'Fiscal' },
]

export default function AdminDesktopNavigation() {
  const [target, setTarget] = useState<Element | null>(null)
  const [active, setActive] = useState<AdminDestination>(() => window.location.hash === '#admin/painels' ? 'panels' : 'executive')

  useEffect(() => {
    const sync = () => setTarget(document.querySelector('.admin-exec-sidebar nav'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => onAdminNavigate((destination) => {
    if (destination !== 'settings') setActive(destination)
  }), [])

  if (!target) return null

  return createPortal(<div className="hrx-admin-desktop-nav" aria-label="Áreas administrativas">
    <div className="hrx-admin-desktop-divider"><span>GESTÃO</span></div>
    {items.map((item) => <button key={item.destination} className={active === item.destination ? 'is-active' : ''} type="button" onClick={() => navigateAdmin(item.destination)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
  </div>, target)
}
