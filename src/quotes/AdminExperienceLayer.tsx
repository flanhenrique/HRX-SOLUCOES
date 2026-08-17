import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'
import './admin-experience.css'

type CnpjLookup = {
  cnpj: string
  legalName: string
  tradeName: string
  status: string
  openedAt?: string | null
  phone: string
  email: string
  address: string
  city: string
  state: string
  zipCode: string
  cnaeCode?: string | number | null
  cnaeDescription: string
  source: string
  officialAutomatic: boolean
  officialNote: string
  sefazVerificationUrl?: string | null
  checkedAt: string
}

type SettingsView = 'home' | 'password'

function setReactInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function findField(modal: Element, labelText: string) {
  const labels = Array.from(modal.querySelectorAll('label'))
  const label = labels.find((item) => item.textContent?.trim().startsWith(labelText))
  return label?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length !== 14) return digits
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function buildFiscalNotes(data: CnpjLookup, current: string) {
  const lines = [
    current.trim(),
    `Consulta CNPJ: ${data.legalName || data.tradeName}`,
    data.status ? `Situação cadastral: ${data.status}` : '',
    data.address ? `Endereço cadastral: ${data.address}` : '',
    data.cnaeDescription ? `CNAE principal: ${data.cnaeCode ? `${data.cnaeCode} · ` : ''}${data.cnaeDescription}` : '',
    `Fonte da consulta automática: ${data.source}`,
    `Consultado em: ${new Date(data.checkedAt).toLocaleString('pt-BR')}`,
  ].filter(Boolean)
  return [...new Set(lines)].join('\n')
}

export default function AdminExperienceLayer() {
  const [sidebarTarget, setSidebarTarget] = useState<Element | null>(null)
  const [mobileTarget, setMobileTarget] = useState<Element | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsView, setSettingsView] = useState<SettingsView>('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [clientDocumentTarget, setClientDocumentTarget] = useState<Element | null>(null)
  const [clientModal, setClientModal] = useState<Element | null>(null)
  const [cnpjBusy, setCnpjBusy] = useState(false)
  const [cnpjMessage, setCnpjMessage] = useState('')
  const [cnpjResult, setCnpjResult] = useState<CnpjLookup | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    void hrxSupabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  useEffect(() => {
    const syncTargets = () => {
      setSidebarTarget(document.querySelector('.admin-exec-sidebar nav'))
      setMobileTarget(document.querySelector('.admin-mobile-nav'))

      const modals = Array.from(document.querySelectorAll('.admin-ops-modal'))
      const addClientModal = modals.find((modal) => modal.querySelector('h3')?.textContent?.trim() === 'Adicionar cliente') ?? null
      setClientModal(addClientModal)
      if (!addClientModal) {
        setClientDocumentTarget(null)
        setCnpjResult(null)
        setCnpjMessage('')
        return
      }
      const labels = Array.from(addClientModal.querySelectorAll('label'))
      const documentLabel = labels.find((label) => label.textContent?.trim().startsWith('CPF/CNPJ')) ?? null
      setClientDocumentTarget(documentLabel)
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

  const passwordValid = useMemo(() => password.length >= 8 && password === confirmPassword, [password, confirmPassword])

  const closeSettings = () => {
    if (passwordBusy) return
    setSettingsOpen(false)
    setSettingsView('home')
    setPassword('')
    setConfirmPassword('')
    setPasswordMessage('')
    setPasswordSuccess(false)
  }

  const openSettings = () => {
    setMobileMenuOpen(false)
    setSettingsView('home')
    setSettingsOpen(true)
  }

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!passwordValid) return
    setPasswordBusy(true)
    setPasswordMessage('')
    setPasswordSuccess(false)
    const { error } = await hrxSupabase.auth.updateUser({ password })
    setPasswordBusy(false)
    if (error) {
      setPasswordMessage('Não foi possível alterar a senha. Entre novamente e tente outra vez.')
      return
    }
    setPassword('')
    setConfirmPassword('')
    setPasswordSuccess(true)
    setPasswordMessage('Senha alterada com sucesso. A nova senha já vale para o próximo acesso.')
  }

  const openOperation = (index: number) => {
    setMobileMenuOpen(false)
    const buttons = Array.from(document.querySelectorAll('.admin-ops-nav')) as HTMLButtonElement[]
    buttons[index]?.click()
  }

  const openQuotes = () => {
    setMobileMenuOpen(false)
    const closeButton = document.querySelector('.admin-ops-header button[aria-label="Fechar"]') as HTMLButtonElement | null
    closeButton?.click()
  }

  const lookupCnpj = async () => {
    if (!clientModal) return
    const documentInput = findField(clientModal, 'CPF/CNPJ') as HTMLInputElement | null
    const raw = documentInput?.value ?? ''
    const cnpj = raw.replace(/\D/g, '')
    if (cnpj.length !== 14) {
      setCnpjResult(null)
      setCnpjMessage('Informe um CNPJ com 14 dígitos para consultar.')
      return
    }

    setCnpjBusy(true)
    setCnpjMessage('Consultando cadastro…')
    setCnpjResult(null)
    const { data, error } = await hrxSupabase.functions.invoke<CnpjLookup>('cnpj-lookup', { body: { cnpj } })
    setCnpjBusy(false)

    if (error || !data) {
      setCnpjMessage('Não foi possível consultar este CNPJ agora. Confira o número e tente novamente.')
      return
    }

    const nameInput = findField(clientModal, 'Nome / responsável')
    const companyInput = findField(clientModal, 'Empresa')
    const emailInput = findField(clientModal, 'E-mail')
    const phoneInput = findField(clientModal, 'Telefone / WhatsApp')
    const notesInput = findField(clientModal, 'Observações') as HTMLTextAreaElement | null

    if (documentInput) setReactInputValue(documentInput, formatCnpj(data.cnpj))
    if (companyInput) setReactInputValue(companyInput, data.tradeName || data.legalName || '')
    if (nameInput && !nameInput.value.trim()) setReactInputValue(nameInput, data.legalName || data.tradeName || '')
    if (emailInput && !emailInput.value.trim() && data.email) setReactInputValue(emailInput, data.email)
    if (phoneInput && !phoneInput.value.trim() && data.phone) setReactInputValue(phoneInput, data.phone)
    if (notesInput) setReactInputValue(notesInput, buildFiscalNotes(data, notesInput.value))

    setCnpjResult(data)
    setCnpjMessage('Dados encontrados e preenchidos. Revise antes de salvar o cliente.')
  }

  const desktopSettingsPortal = sidebarTarget ? createPortal(
    <>
      <div className="hrx-nav-divider"><span>SISTEMA</span></div>
      <button type="button" className="hrx-settings-nav" onClick={openSettings}><span aria-hidden="true">⚙</span>Configurações</button>
    </>,
    sidebarTarget,
  ) : null

  const mobileMenuPortal = mobileTarget ? createPortal(
    <button type="button" className="hrx-mobile-menu-launcher" onClick={() => setMobileMenuOpen(true)}><span>☰</span>Menu</button>,
    mobileTarget,
  ) : null

  const cnpjPortal = clientDocumentTarget ? createPortal(
    <div className="hrx-cnpj-assistant">
      <button type="button" onClick={() => void lookupCnpj()} disabled={cnpjBusy}>{cnpjBusy ? 'Consultando…' : 'Consultar CNPJ'}</button>
      <small>{cnpjMessage || 'Preencha o CNPJ e use a consulta para completar os dados cadastrais.'}</small>
      {cnpjResult && <div className="hrx-cnpj-result">
        <strong>{cnpjResult.legalName || cnpjResult.tradeName}</strong>
        <span>{cnpjResult.status || 'Situação não informada'}{cnpjResult.city ? ` · ${cnpjResult.city}/${cnpjResult.state}` : ''}</span>
        <em>Fonte automática: {cnpjResult.source}</em>
        {cnpjResult.sefazVerificationUrl && <a href={cnpjResult.sefazVerificationUrl} target="_blank" rel="noreferrer">Verificar cadastro na SEFAZ/AM ↗</a>}
      </div>}
    </div>,
    clientDocumentTarget,
  ) : null

  return <>
    {desktopSettingsPortal}
    {mobileMenuPortal}
    {cnpjPortal}

    {mobileMenuOpen && <div className="hrx-mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenuOpen(false) }}>
      <section className="hrx-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu do HRX Admin">
        <header><div><span>HRX ADMIN</span><h2>Navegação</h2></div><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar">×</button></header>
        <div className="hrx-mobile-menu-grid">
          <button type="button" onClick={openQuotes}><span>▦</span><strong>Orçamentos</strong><small>Fila e editor</small></button>
          <button type="button" onClick={() => openOperation(0)}><span>♙</span><strong>Clientes</strong><small>Catálogo e histórico</small></button>
          <button type="button" onClick={() => openOperation(1)}><span>Ⅱ</span><strong>Suspensões</strong><small>Parados e retomadas</small></button>
          <button type="button" onClick={openSettings}><span>⚙</span><strong>Configurações</strong><small>Conta e segurança</small></button>
        </div>
        <button type="button" className="hrx-mobile-refresh" onClick={() => window.location.reload()}>↻ Atualizar dados</button>
      </section>
    </div>}

    {settingsOpen && <section className="hrx-settings-shell" role="dialog" aria-modal="true" aria-label="Configurações do HRX Admin">
      <header className="hrx-settings-header"><div><span>HRX · SISTEMA</span><h2>Configurações</h2></div><button type="button" onClick={closeSettings} aria-label="Fechar">×</button></header>
      <div className="hrx-settings-body">
        <aside className="hrx-settings-menu">
          <button type="button" className={settingsView === 'home' ? 'is-active' : ''} onClick={() => setSettingsView('home')}><span>⌂</span><div><strong>Conta</strong><small>Perfil e sessão</small></div></button>
          <button type="button" className={settingsView === 'password' ? 'is-active' : ''} onClick={() => setSettingsView('password')}><span>⌁</span><div><strong>Segurança</strong><small>Alterar senha</small></div></button>
        </aside>

        <main className="hrx-settings-content">
          {settingsView === 'home' && <>
            <div className="hrx-settings-title"><span>CONTA ADMINISTRATIVA</span><h3>Seu acesso</h3><p>Gerencie as informações e a segurança usadas no HRX Admin.</p></div>
            <section className="hrx-settings-card">
              <div className="hrx-settings-account"><span>HR</span><div><strong>Administrador HRX</strong><small>{email || 'Conta autenticada'}</small></div></div>
              <dl><div><dt>Perfil</dt><dd>Administrador</dd></div><div><dt>Ambiente</dt><dd>HRX Admin PWA</dd></div></dl>
            </section>
            <section className="hrx-settings-card hrx-settings-security-row"><div><span>SEGURANÇA</span><strong>Senha de acesso</strong><small>Troque sua senha periodicamente e não reutilize credenciais.</small></div><button type="button" onClick={() => setSettingsView('password')}>Alterar senha</button></section>
          </>}

          {settingsView === 'password' && <form className="hrx-settings-password" onSubmit={changePassword}>
            <div className="hrx-settings-title"><span>SEGURANÇA</span><h3>Alterar senha</h3><p>A nova senha será usada nos próximos acessos ao painel administrativo.</p></div>
            <label>Nova senha<div className="hrx-settings-password-field"><input type={showPassword ? 'text' : 'password'} minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div><small>Mínimo de 8 caracteres.</small></label>
            <label>Confirmar nova senha<input type={showPassword ? 'text' : 'password'} minLength={8} required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            {confirmPassword && password !== confirmPassword && <div className="hrx-settings-message is-warning">As senhas precisam ser iguais.</div>}
            {passwordMessage && <div className={`hrx-settings-message ${passwordSuccess ? 'is-success' : 'is-error'}`}>{passwordMessage}</div>}
            <div className="hrx-settings-actions"><button type="button" onClick={() => setSettingsView('home')}>Cancelar</button><button className="is-primary" type="submit" disabled={!passwordValid || passwordBusy}>{passwordBusy ? 'Alterando…' : 'Salvar nova senha'}</button></div>
          </form>}
        </main>
      </div>
    </section>}
  </>
}
