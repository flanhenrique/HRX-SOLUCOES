import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const NEXUS_CAPTURE = '/nexus-login.webp'

type PortalTargets = {
  hero: Element | null
  nexus: Element | null
}

function HortiMark() {
  return (
    <span className="portfolio-horti-lockup" aria-label="Hortifruti Revolução">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 40V17" />
        <path d="M24 27C15 26 10 20 10 11c9 0 14 5 14 16Z" />
        <path d="M24 22C30 22 36 17 38 9c-8-1-14 4-14 13Z" />
        <path d="M24 34c-7 0-12-4-14-10 7-1 12 3 14 10Z" />
        <path d="M24 31c6 0 11-3 14-9-7-1-12 2-14 9Z" />
      </svg>
      <span>REVOLUÇÃO<small>HORTIFRUTI</small></span>
    </span>
  )
}

function HortifrutiHeroCard() {
  return (
    <a className="showcase-card authentic-hortifruti" href="#projetos" aria-label="Ver projeto Hortifruti Revolução">
      <div className="portfolio-horti-topline"><HortiMark /><span>NOVO CASE</span></div>
      <strong>Site institucional + aplicativo B2B.</strong>
      <p>Presença digital, portal de pedidos e operação conectada.</p>
      <span className="showcase-action portfolio-horti-action">Ver projeto ↗</span>
    </a>
  )
}

function NexusCapture() {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="nexus-capture-unavailable" role="status">
        <span>MAP.i</span>
        <strong>NEXUS</strong>
        <p>Aplicação corporativa de acesso restrito.</p>
        <small>Gestão comercial e operacional em ambiente interno.</small>
      </div>
    )
  }

  return (
    <img
      className="nexus-capture-image"
      src={NEXUS_CAPTURE}
      alt="Captura real da tela do MAP.i Nexus"
      onError={() => setFailed(true)}
    />
  )
}

export default function PublicPortfolioEnhancements() {
  const [targets, setTargets] = useState<PortalTargets>({ hero: null, nexus: null })

  useEffect(() => {
    const resolveTargets = () => {
      setTargets({
        hero: document.querySelector('.authentic-showcase'),
        nexus: document.querySelector('.nexus-login-shot'),
      })
    }

    resolveTargets()
    const observer = new MutationObserver(resolveTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {targets.hero ? createPortal(<HortifrutiHeroCard />, targets.hero) : null}
      {targets.nexus ? createPortal(<NexusCapture />, targets.nexus) : null}
    </>
  )
}
