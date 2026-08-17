import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'
import './suspended-quote-guard.css'

type SuspensionState = { suspended: boolean; reason?: string | null; note?: string | null }

export default function SuspendedQuoteGuard() {
  const [protocol, setProtocol] = useState('')
  const [target, setTarget] = useState<Element | null>(null)
  const [state, setState] = useState<SuspensionState>({ suspended: false })

  useEffect(() => {
    const sync = () => {
      const shell = document.querySelector('.admin-editor-shell')
      const identity = document.querySelector('.admin-editor-identity > span')
      const nextProtocol = identity?.textContent?.trim() ?? ''
      setTarget(shell)
      setProtocol((current) => current === nextProtocol ? current : nextProtocol)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!protocol) {
        setState({ suspended: false })
        return
      }
      const { data: request } = await hrxSupabase.from('quote_requests').select('id').eq('protocol', protocol).maybeSingle()
      if (!request?.id || cancelled) return
      const { data: draft } = await hrxSupabase.from('quote_drafts').select('status,suspension_reason,suspension_note').eq('request_id', request.id).maybeSingle()
      if (cancelled) return
      setState({ suspended: draft?.status === 'suspended', reason: draft?.suspension_reason, note: draft?.suspension_note })
    }
    void check()
    return () => { cancelled = true }
  }, [protocol])

  useEffect(() => {
    if (!target) return
    target.classList.toggle('hrx-quote-is-suspended', state.suspended)
    return () => target.classList.remove('hrx-quote-is-suspended')
  }, [target, state.suspended])

  if (!target || !state.suspended) return null
  return createPortal(
    <div className="hrx-suspended-banner" role="status">
      <span>ORÇAMENTO SUSPENSO</span>
      <strong>{state.reason || 'Aguardando retomada'}</strong>
      {state.note && <small>{state.note}</small>}
      <em>Retome o orçamento no módulo Suspensões para voltar a editar ou aprovar.</em>
    </div>,
    target,
  )
}
