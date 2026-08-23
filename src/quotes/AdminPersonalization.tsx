import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { navigateAdmin } from './adminNavigation'
import { hrxSupabase } from './supabaseClient'
import './admin-personalization.css'

type Appearance = 'system' | 'dark' | 'light'
type Accent = 'blue' | 'cyan' | 'violet' | 'green'
type Density = 'comfortable' | 'compact'
type InterfaceSize = 'small' | 'standard' | 'large'

type Preferences = {
  appearance: Appearance
  accent: Accent
  density: Density
  size: InterfaceSize
  reduceMotion: boolean
}

const STORAGE_KEY = 'hrx:admin:ui-preferences:v1'
const DEFAULTS: Preferences = {
  appearance: 'system',
  accent: 'blue',
  density: 'comfortable',
  size: 'standard',
  reduceMotion: false,
}

function normalizePreferences(value: unknown): Preferences {
  const input = value && typeof value === 'object' ? value as Partial<Preferences> : {}
  return {
    appearance: ['system', 'dark', 'light'].includes(String(input.appearance)) ? input.appearance as Appearance : DEFAULTS.appearance,
    accent: ['blue', 'cyan', 'violet', 'green'].includes(String(input.accent)) ? input.accent as Accent : DEFAULTS.accent,
    density: ['comfortable', 'compact'].includes(String(input.density)) ? input.density as Density : DEFAULTS.density,
    size: ['small', 'standard', 'large'].includes(String(input.size)) ? input.size as InterfaceSize : DEFAULTS.size,
    reduceMotion: Boolean(input.reduceMotion),
  }
}

function readLocalPreferences() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalizePreferences(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeLocalPreferences(preferences: Preferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // O armazenamento local é auxiliar; o painel continua funcional sem ele.
  }
}

function GearIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l-2.83 2.83A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 1.55V21h-4a1.7 1.7 0 0 0-1-1.63 1.7 1.7 0 0 0-1.88.34l-2.83-2.83A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1H3v-4a1.7 1.7 0 0 0 1.63-1 1.7 1.7 0 0 0-.34-1.88l2.83-2.83A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4a1.7 1.7 0 0 0 1 1.63 1.7 1.7 0 0 0 1.88-.34l2.83 2.83A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4a1.7 1.7 0 0 0-1.6 1Z"/></svg>
}

export default function AdminPersonalization() {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [preferences, setPreferences] = useState<Preferences>(() => readLocalPreferences() ?? DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const originalRootFontSize = useRef('')

  useEffect(() => {
    originalRootFontSize.current = document.documentElement.style.fontSize
    return () => {
      document.documentElement.style.fontSize = originalRootFontSize.current
    }
  }, [])

  useEffect(() => {
    let disposed = false
    const findHost = () => {
      if (disposed) return
      const host = document.querySelector<HTMLElement>('.hrx-glass-topbar')
      setPortalHost((current) => current === host ? current : host)
    }
    findHost()
    const observer = new MutationObserver(findHost)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      disposed = true
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    let active = true
    const loadRemote = async () => {
      const { data } = await hrxSupabase.auth.getUser()
      const remote = data.user?.user_metadata?.hrx_ui_preferences
      if (!active || !remote) return
      const next = normalizePreferences(remote)
      setPreferences(next)
      writeLocalPreferences(next)
    }
    void loadRemote()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!portalHost) return
    const root = document.querySelector<HTMLElement>('.hrx-glass-app')
    if (!root) return

    const media = window.matchMedia('(prefers-color-scheme: light)')
    const applyTheme = () => {
      root.dataset.hrxTheme = preferences.appearance === 'system'
        ? media.matches ? 'light' : 'dark'
        : preferences.appearance
    }

    root.dataset.hrxAppearance = preferences.appearance
    root.dataset.hrxAccent = preferences.accent
    root.dataset.hrxDensity = preferences.density
    root.dataset.hrxSize = preferences.size
    root.dataset.hrxReduceMotion = preferences.reduceMotion ? 'true' : 'false'
    document.documentElement.style.fontSize = preferences.size === 'small' ? '15px' : preferences.size === 'large' ? '17px' : '16px'
    applyTheme()

    if (preferences.appearance === 'system') media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [portalHost, preferences])

  useEffect(() => {
    if (!portalHost) return
    const notificationButton = portalHost.querySelector<HTMLButtonElement>('.hrx-notifications')
    if (!notificationButton) return
    notificationButton.title = 'Abrir notificações e atividades'
    const openNotifications = () => navigateAdmin('activities')
    notificationButton.addEventListener('click', openNotifications)
    return () => notificationButton.removeEventListener('click', openNotifications)
  }, [portalHost])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const persist = async (next: Preferences) => {
    setSaving(true)
    setMessage('')
    writeLocalPreferences(next)
    const { error } = await hrxSupabase.auth.updateUser({ data: { hrx_ui_preferences: next } })
    setSaving(false)
    setMessage(error ? 'Preferências salvas neste dispositivo.' : 'Preferências salvas no seu perfil.')
  }

  const save = async () => {
    await persist(preferences)
  }

  const restoreDefaults = async () => {
    setPreferences(DEFAULTS)
    await persist(DEFAULTS)
  }

  const trigger = portalHost ? createPortal(
    <button className="hrx-personalize-trigger" type="button" onClick={() => setOpen(true)} aria-label="Personalizar interface" title="Personalizar interface">
      <GearIcon />
    </button>,
    portalHost,
  ) : null

  return <>
    {trigger}
    {open && <div className="hrx-personalization-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="hrx-personalization-panel" role="dialog" aria-modal="true" aria-labelledby="hrx-personalization-title">
        <header>
          <div><span>EXPERIÊNCIA HRX</span><h2 id="hrx-personalization-title">Personalizar interface</h2><p>As mudanças são aplicadas imediatamente para você visualizar antes de salvar.</p></div>
          <button type="button" className="hrx-personalization-close" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
        </header>

        <div className="hrx-personalization-section">
          <div><strong>Aparência</strong><small>Automática, escura ou clara.</small></div>
          <div className="hrx-segmented-control" role="group" aria-label="Aparência">
            {([['system','Automática'],['dark','Escura'],['light','Clara']] as const).map(([value,label]) => <button key={value} type="button" className={preferences.appearance === value ? 'is-active' : ''} aria-pressed={preferences.appearance === value} onClick={() => setPreferences((current) => ({ ...current, appearance: value }))}>{label}</button>)}
          </div>
        </div>

        <div className="hrx-personalization-section">
          <div><strong>Cor de destaque</strong><small>O azul HRX continua sendo o padrão.</small></div>
          <div className="hrx-accent-options" role="group" aria-label="Cor de destaque">
            {(['blue','cyan','violet','green'] as Accent[]).map((accent) => <button key={accent} type="button" data-accent={accent} className={preferences.accent === accent ? 'is-active' : ''} aria-label={`Destaque ${accent}`} aria-pressed={preferences.accent === accent} onClick={() => setPreferences((current) => ({ ...current, accent }))}><i/></button>)}
          </div>
        </div>

        <div className="hrx-personalization-section">
          <div><strong>Densidade</strong><small>Escolha quanto conteúdo aparece por tela.</small></div>
          <div className="hrx-segmented-control" role="group" aria-label="Densidade">
            {([['comfortable','Confortável'],['compact','Compacta']] as const).map(([value,label]) => <button key={value} type="button" className={preferences.density === value ? 'is-active' : ''} aria-pressed={preferences.density === value} onClick={() => setPreferences((current) => ({ ...current, density: value }))}>{label}</button>)}
          </div>
        </div>

        <div className="hrx-personalization-section">
          <div><strong>Tamanho da interface</strong><small>Ajusta textos, controles e espaçamento proporcionalmente.</small></div>
          <div className="hrx-segmented-control" role="group" aria-label="Tamanho da interface">
            {([['small','Pequena'],['standard','Padrão'],['large','Grande']] as const).map(([value,label]) => <button key={value} type="button" className={preferences.size === value ? 'is-active' : ''} aria-pressed={preferences.size === value} onClick={() => setPreferences((current) => ({ ...current, size: value }))}>{label}</button>)}
          </div>
        </div>

        <label className="hrx-personalization-toggle">
          <span><strong>Reduzir animações</strong><small>Diminui transições e movimentos da interface.</small></span>
          <input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => setPreferences((current) => ({ ...current, reduceMotion: event.target.checked }))}/>
          <i aria-hidden="true"/>
        </label>

        {message && <p className="hrx-personalization-message" role="status">{message}</p>}
        <footer>
          <button type="button" className="hrx-personalization-reset" onClick={() => void restoreDefaults()} disabled={saving}>Restaurar padrão HRX</button>
          <button type="button" className="hrx-personalization-save" onClick={() => void save()} disabled={saving}>{saving ? 'Salvando…' : 'Salvar preferências'}</button>
        </footer>
      </section>
    </div>}
  </>
}
