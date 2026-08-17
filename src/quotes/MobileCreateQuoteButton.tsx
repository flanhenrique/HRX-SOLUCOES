import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './mobile-create-quote.css'

export default function MobileCreateQuoteButton() {
  const [target, setTarget] = useState<Element | null>(null)

  useEffect(() => {
    const syncTarget = () => setTarget(document.querySelector('.admin-exec-topbar .admin-exec-system'))
    syncTarget()

    const observer = new MutationObserver(syncTarget)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  if (!target) return null

  const openCreateQuote = () => {
    const sourceButton = document.querySelector<HTMLButtonElement>('.admin-ops-new-quote')
    sourceButton?.click()
  }

  return createPortal(
    <button
      type="button"
      className="hrx-mobile-create-quote"
      onClick={openCreateQuote}
      aria-label="Criar orçamento"
    >
      <span aria-hidden="true">＋</span>
      Criar orçamento
    </button>,
    target,
  )
}
