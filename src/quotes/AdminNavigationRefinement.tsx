import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './admin-navigation-refinement.css'

export default function AdminNavigationRefinement() {
  const [menuGrid, setMenuGrid] = useState<Element | null>(null)

  useEffect(() => {
    const sync = () => setMenuGrid(document.querySelector('.hrx-mobile-menu-grid'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const closeMenu = () => {
    const close = document.querySelector('.hrx-mobile-menu header button[aria-label="Fechar"]') as HTMLButtonElement | null
    close?.click()
  }

  const openDocuments = () => {
    closeMenu()
    window.dispatchEvent(new CustomEvent('hrx:open-documents'))
  }

  const openPanels = () => {
    closeMenu()
    window.location.hash = '#admin/painels'
  }

  const openFiscal = () => {
    closeMenu()
    const fiscalButton = document.querySelector<HTMLButtonElement>('.admin-fiscal-nav')
    fiscalButton?.click()
  }

  if (!menuGrid) return null

  return createPortal(<>
    <button type="button" className="hrx-audit-menu-card" onClick={openDocuments}><span>▤</span><strong>Central de documentos</strong><small>Arquivos, contratos e governança</small></button>
    <button type="button" className="hrx-audit-menu-card" onClick={openPanels}><span>▦</span><strong>Painéis</strong><small>Projetos, prioridades e progresso</small></button>
    <button type="button" className="hrx-audit-menu-card" onClick={openFiscal}><span>◇</span><strong>Fiscal</strong><small>Cadastro e situação tributária</small></button>
  </>, menuGrid)
}
