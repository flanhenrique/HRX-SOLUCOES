import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function openSettings() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.hrx-glass-sidebar nav button'))
  buttons.find((button) => button.textContent?.includes('Configurações'))?.click()
}

export default function AdminSettingsShortcut() {
  const [topbar, setTopbar] = useState<HTMLElement | null>(null)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)

  useEffect(() => {
    const host = document.getElementById('root')
    if (!host) return
    const sync = () => setTopbar(document.querySelector<HTMLElement>('.hrx-glass-topbar'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(host, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const onChange = (event: MediaQueryListEvent) => setMobile(event.matches)
    setMobile(media.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  if (!mobile || !topbar) return null

  return createPortal(
    <button
      type="button"
      aria-label="Abrir configurações de aparência"
      title="Configurações"
      onClick={openSettings}
      style={{
        flex: '0 0 44px',
        width: 44,
        height: 44,
        minWidth: 44,
        padding: 0,
        display: 'grid',
        placeItems: 'center',
        border: '1px solid var(--hrx-border)',
        borderRadius: 11,
        background: 'var(--hrx-surface)',
        color: 'var(--hrx-text)',
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l-2.83 2.83A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 1.55V21h-4a1.7 1.7 0 0 0-1-1.63 1.7 1.7 0 0 0-1.88.34l-2.83-2.83A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1H3v-4a1.7 1.7 0 0 0 1.63-1 1.7 1.7 0 0 0-.34-1.88l2.83-2.83A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4a1.7 1.7 0 0 0 1 1.63 1.7 1.7 0 0 0 1.88-.34l2.83 2.83A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4a1.7 1.7 0 0 0-1.6 1Z" />
      </svg>
    </button>,
    topbar,
  )
}
