import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hrxSupabase } from './supabaseClient'
import './admin-password-control.css'

function isRecoveryFlow() {
  const search = new URLSearchParams(window.location.search)
  return search.get('recovery') === '1' || /(?:^|[#&])type=recovery(?:&|$)/.test(window.location.hash)
}

export default function AdminPasswordControl() {
  const [session, setSession] = useState<Session | null>(null)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    void hrxSupabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = hrxSupabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  const valid = useMemo(
    () => password.length >= 8 && password === confirmPassword,
    [password, confirmPassword],
  )

  if (!session || isRecoveryFlow()) return null

  const close = () => {
    if (busy) return
    setOpen(false)
    setPassword('')
    setConfirmPassword('')
    setMessage('')
    setSuccess(false)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return

    setBusy(true)
    setMessage('')
    setSuccess(false)

    const { error } = await hrxSupabase.auth.updateUser({ password })
    setBusy(false)

    if (error) {
      setMessage('Não foi possível alterar a senha agora. Entre novamente e tente outra vez.')
      return
    }

    setPassword('')
    setConfirmPassword('')
    setSuccess(true)
    setMessage('Senha alterada com sucesso. Ela já vale para o próximo acesso.')
  }

  return (
    <>
      <button className="admin-password-launcher" type="button" onClick={() => setOpen(true)}>
        Alterar senha
      </button>

      {open && (
        <div className="admin-password-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close()
        }}>
          <form className="admin-password-modal" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="admin-password-title">
            <div className="admin-password-heading">
              <div>
                <span>HRX · SEGURANÇA</span>
                <h2 id="admin-password-title">Alterar senha</h2>
              </div>
              <button type="button" className="admin-password-close" onClick={close} aria-label="Fechar">×</button>
            </div>

            <p>Defina uma nova senha para os próximos acessos ao HRX Admin.</p>

            <label className="admin-field">
              Nova senha
              <span className="admin-password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
            </label>

            <label className="admin-field">
              Confirmar nova senha
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>

            {confirmPassword && password !== confirmPassword && (
              <div className="admin-login-message is-warning">As senhas precisam ser iguais.</div>
            )}
            {message && (
              <div className={`admin-login-message ${success ? '' : 'is-error'}`} role="status">{message}</div>
            )}

            <div className="admin-password-actions">
              <button type="button" className="button button-secondary" onClick={close} disabled={busy}>Cancelar</button>
              <button type="submit" className="button button-primary" disabled={!valid || busy}>
                {busy ? 'Alterando…' : 'Salvar nova senha'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
