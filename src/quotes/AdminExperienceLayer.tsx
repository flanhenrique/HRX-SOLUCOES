import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'
import { navigateAdmin, type AdminDestination } from './adminNavigation'
import { passwordMeetsPolicy, passwordRequirementText, secureUpdateAdminPassword } from './passwordSecurity'
import './admin-experience.css'

type SettingsView = 'home' | 'password'

export default function AdminExperienceLayer() {
  const [sidebarTarget, setSidebarTarget] = useState<Element | null>(null)
  const [mobileTarget, setMobileTarget] = useState<Element | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsView, setSettingsView] = useState<SettingsView>('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => { void hrxSupabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')) }, [])

  useEffect(() => {
    const syncTargets = () => {
      setSidebarTarget(document.querySelector('.admin-exec-sidebar nav'))
      setMobileTarget(document.querySelector('.admin-mobile-nav'))
    }
    syncTargets()
    const observer = new MutationObserver(syncTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('hrx-settings-open', settingsOpen)
    document.documentElement.classList.toggle('hrx-mobile-menu-open', mobileMenuOpen)
    return () => {
      document.documentElement.classList.remove('hrx-settings-open')
      document.documentElement.classList.remove('hrx-mobile-menu-open')
    }
  }, [settingsOpen, mobileMenuOpen])

  const passwordValid = useMemo(() => passwordMeetsPolicy(password) && password === confirmPassword, [password, confirmPassword])

  const closeSettings = () => {
    if (passwordBusy) return
    setSettingsOpen(false); setSettingsView('home'); setPassword(''); setConfirmPassword(''); setPasswordMessage(''); setPasswordSuccess(false)
  }

  const openSettings = () => { setMobileMenuOpen(false); setSettingsView('home'); setSettingsOpen(true) }
  const openDestination = (destination: AdminDestination) => { setMobileMenuOpen(false); navigateAdmin(destination) }

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!passwordValid) return
    setPasswordBusy(true); setPasswordMessage(''); setPasswordSuccess(false)
    const result = await secureUpdateAdminPassword(password)
    setPasswordBusy(false)
    if (!result.ok) { setPasswordMessage(result.message); return }
    setPassword(''); setConfirmPassword(''); setPasswordSuccess(true); setPasswordMessage('Senha alterada com sucesso e validada pela política de segurança da HRX.')
  }

  const desktopSettingsPortal = sidebarTarget ? createPortal(<><div className="hrx-nav-divider"><span>SISTEMA</span></div><button type="button" className="hrx-settings-nav" onClick={openSettings}><span aria-hidden="true">⚙</span>Configurações</button></>, sidebarTarget) : null
  const mobileMenuPortal = mobileTarget ? createPortal(<button type="button" className="hrx-mobile-menu-launcher" onClick={() => setMobileMenuOpen(true)}><span>☰</span>Menu</button>, mobileTarget) : null

  return <>
    {desktopSettingsPortal}{mobileMenuPortal}
    {mobileMenuOpen && <div className="hrx-mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenuOpen(false) }}><section className="hrx-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu do HRX Admin"><header><div><span>HRX ADMIN</span><h2>Navegação</h2></div><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar">×</button></header><div className="hrx-mobile-menu-grid">
      <button type="button" onClick={() => openDestination('executive')}><span>◫</span><strong>Visão executiva</strong><small>Negócio, indicadores e atenção</small></button>
      <button type="button" onClick={() => openDestination('quotes')}><span>▦</span><strong>Orçamentos</strong><small>Fila e editor</small></button>
      <button type="button" onClick={() => openDestination('clients')}><span>♙</span><strong>Clientes</strong><small>Catálogo e histórico</small></button>
      <button type="button" onClick={() => openDestination('suspensions')}><span>Ⅱ</span><strong>Suspensões</strong><small>Parados e retomadas</small></button>
      <button type="button" onClick={() => openDestination('documents')}><span>▤</span><strong>Central de documentos</strong><small>Arquivos, contratos e governança</small></button>
      <button type="button" onClick={() => openDestination('panels')}><span>▦</span><strong>Painéis</strong><small>Projetos, prioridades e progresso</small></button>
      <button type="button" onClick={() => openDestination('fiscal')}><span>◇</span><strong>Fiscal</strong><small>Cadastro e situação tributária</small></button>
      <button type="button" onClick={openSettings}><span>⚙</span><strong>Configurações</strong><small>Conta e segurança</small></button>
    </div><button type="button" className="hrx-mobile-refresh" onClick={() => window.location.reload()}>↻ Atualizar dados</button></section></div>}

    {settingsOpen && <section className="hrx-settings-shell" role="dialog" aria-modal="true" aria-label="Configurações do HRX Admin"><header className="hrx-settings-header"><div><span>HRX · SISTEMA</span><h2>Configurações</h2></div><button type="button" onClick={closeSettings} aria-label="Fechar">×</button></header><div className="hrx-settings-body"><aside className="hrx-settings-menu"><button type="button" className={settingsView === 'home' ? 'is-active' : ''} onClick={() => setSettingsView('home')}><span>⌂</span><div><strong>Conta</strong><small>Perfil e sessão</small></div></button><button type="button" className={settingsView === 'password' ? 'is-active' : ''} onClick={() => setSettingsView('password')}><span>⌁</span><div><strong>Segurança</strong><small>Alterar senha</small></div></button></aside><main className="hrx-settings-content">
      {settingsView === 'home' && <><div className="hrx-settings-title"><span>CONTA ADMINISTRATIVA</span><h3>Seu acesso</h3><p>Gerencie as informações e a segurança usadas no HRX Admin.</p></div><section className="hrx-settings-card"><div className="hrx-settings-account"><span>HR</span><div><strong>Administrador HRX</strong><small>{email || 'Conta autenticada'}</small></div></div><dl><div><dt>Perfil</dt><dd>Administrador</dd></div><div><dt>Ambiente</dt><dd>HRX Admin PWA</dd></div></dl></section><section className="hrx-settings-card hrx-settings-security-row"><div><span>SEGURANÇA</span><strong>Senha de acesso</strong><small>Use uma senha exclusiva e mantenha a verificação em duas etapas ativa.</small></div><button type="button" onClick={() => setSettingsView('password')}>Alterar senha</button></section></>}
      {settingsView === 'password' && <form className="hrx-settings-password" onSubmit={changePassword}><div className="hrx-settings-title"><span>SEGURANÇA</span><h3>Alterar senha</h3><p>A nova senha será validada pela mesma política usada no login e na recuperação de acesso.</p></div><label>Nova senha<div className="hrx-settings-password-field"><input type={showPassword ? 'text' : 'password'} minLength={12} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div><small>{passwordRequirementText}</small></label><label>Confirmar nova senha<input type={showPassword ? 'text' : 'password'} minLength={12} required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{password && !passwordMeetsPolicy(password) && <div className="hrx-settings-message is-warning">{passwordRequirementText}</div>}{confirmPassword && password !== confirmPassword && <div className="hrx-settings-message is-warning">As senhas precisam ser iguais.</div>}{passwordMessage && <div className={`hrx-settings-message ${passwordSuccess ? 'is-success' : 'is-error'}`}>{passwordMessage}</div>}<div className="hrx-settings-actions"><button type="button" onClick={() => setSettingsView('home')}>Cancelar</button><button className="is-primary" type="submit" disabled={!passwordValid || passwordBusy}>{passwordBusy ? 'Validando segurança…' : 'Salvar nova senha'}</button></div></form>}
    </main></div></section>}
  </>
}
