import { FormEvent, useEffect, useMemo, useState } from 'react'
import { hrxSupabase } from './supabaseClient'
import { passwordMeetsPolicy, passwordRequirementText, secureUpdateAdminPassword } from './passwordSecurity'

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('Administrador HRX')
  const [userRole, setUserRole] = useState('Administrador')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    void hrxSupabase.auth.getUser().then(({ data, error: userError }) => {
      if (disposed) return
      if (userError || !data.user) {
        setError('Não foi possível carregar os dados da conta administrativa.')
        setLoading(false)
        return
      }
      const metadata = data.user.user_metadata ?? {}
      setEmail(data.user.email ?? '')
      setUserName(metadata.full_name || metadata.name || data.user.email?.split('@')[0] || 'Administrador HRX')
      setUserRole(metadata.role || 'Administrador')
      setLoading(false)
    }).catch(() => {
      if (!disposed) {
        setError('Não foi possível carregar os dados da conta administrativa.')
        setLoading(false)
      }
    })
    return () => { disposed = true }
  }, [])

  const initials = useMemo(() => userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'HR', [userName])

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!passwordMeetsPolicy(password) || password !== confirmPassword) return
    setPasswordBusy(true)
    setPasswordMessage('')
    const result = await secureUpdateAdminPassword(password)
    setPasswordBusy(false)
    setPasswordMessage(result.ok ? 'Senha atualizada com sucesso.' : result.message)
    if (result.ok) {
      setPassword('')
      setConfirmPassword('')
    }
  }

  return <section className="hrx-view hrx-settings-view" aria-labelledby="settings-title">
    <div className="hrx-view-title"><div><h1 id="settings-title">Configurações</h1><p>Perfil, segurança e preferências do ambiente administrativo.</p></div></div>
    {error && <div className="hrx-glass-alert" role="alert">{error}</div>}
    {loading ? <div className="hrx-loading"><span /><strong>Carregando configurações…</strong></div> : <div className="hrx-settings-layout">
      <nav aria-label="Seções de configurações">
        <button type="button" className="is-active"><span><strong>Perfil</strong><small>Conta administrativa</small></span></button>
        <button type="button"><span><strong>Segurança</strong><small>Senha e MFA</small></span></button>
      </nav>
      <div>
        <section className="hrx-settings-card">
          <header><span className="hrx-avatar">{initials}</span><div><h2>{userName}</h2><p>{email || 'Sessão administrativa'}</p></div></header>
          <dl>
            <div><dt>Perfil</dt><dd>{userRole}</dd></div>
            <div><dt>Ambiente</dt><dd>HRX Admin PWA</dd></div>
            <div><dt>Proteção</dt><dd>MFA obrigatório</dd></div>
          </dl>
          <footer><button type="button" onClick={() => void hrxSupabase.auth.signOut()}>Encerrar sessão</button></footer>
        </section>
        <form className="hrx-settings-card" onSubmit={changePassword}>
          <h2>Alterar senha</h2>
          <p>{passwordRequirementText}</p>
          <label>Nova senha<input type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
          <label>Confirmar nova senha<input type="password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></label>
          {confirmPassword && password !== confirmPassword && <span className="hrx-inline-warning">As senhas precisam ser iguais.</span>}
          {passwordMessage && <span className="hrx-inline-message" role="status">{passwordMessage}</span>}
          <button className="hrx-primary-button" disabled={passwordBusy || !passwordMeetsPolicy(password) || password !== confirmPassword}>{passwordBusy ? 'Validando…' : 'Salvar nova senha'}</button>
        </form>
      </div>
    </div>}
  </section>
}
