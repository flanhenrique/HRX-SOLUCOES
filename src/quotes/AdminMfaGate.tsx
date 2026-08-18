import { FormEvent, ReactNode, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hrxSupabase } from './supabaseClient'
import './admin-mfa.css'

type Phase = 'checking' | 'enroll' | 'enrolling' | 'challenge' | 'ready' | 'error'

type Enrollment = {
  factorId: string
  qrCode: string
  secret: string
}

export default function AdminMfaGate({ session, children, allowEnrollment = true }: { session: Session; children: ReactNode; allowEnrollment?: boolean }) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [factorId, setFactorId] = useState('')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const evaluate = async () => {
    setMessage('')
    setPhase('checking')

    const [{ data: aal, error: aalError }, { data: factors, error: factorsError }] = await Promise.all([
      hrxSupabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      hrxSupabase.auth.mfa.listFactors(),
    ])

    if (aalError || factorsError) {
      setMessage('Não foi possível validar a segurança desta sessão.')
      setPhase('error')
      return
    }

    if (aal.currentLevel === 'aal2') {
      setPhase('ready')
      return
    }

    const verifiedTotp = factors.totp.find((factor) => factor.status === 'verified')
    if (verifiedTotp) {
      setFactorId(verifiedTotp.id)
      setPhase('challenge')
      return
    }

    if (!allowEnrollment) {
      setMessage('A recuperação exige um autenticador que já tenha sido verificado nesta conta. Entre em contato com o administrador responsável se o fator não estiver disponível.')
      setPhase('error')
      return
    }

    if (aal.nextLevel === 'aal2' && factors.totp[0]?.id) {
      setFactorId(factors.totp[0].id)
      setPhase('challenge')
      return
    }

    setPhase('enroll')
  }

  useEffect(() => { void evaluate() }, [session.access_token, allowEnrollment])

  const startEnrollment = async () => {
    if (!allowEnrollment) return
    setBusy(true)
    setMessage('')
    setPhase('enrolling')
    const { data, error } = await hrxSupabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'HRX Admin',
      issuer: 'HRX Solutions',
    })
    setBusy(false)

    if (error || !data?.totp) {
      setMessage('Não foi possível iniciar a configuração do autenticador. Tente novamente.')
      setPhase('enroll')
      return
    }

    setFactorId(data.id)
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }

  const verify = async (event: FormEvent) => {
    event.preventDefault()
    const cleanCode = code.replace(/\D/g, '').slice(0, 6)
    if (!factorId || cleanCode.length !== 6) return

    setBusy(true)
    setMessage('')
    const { error } = await hrxSupabase.auth.mfa.challengeAndVerify({ factorId, code: cleanCode })
    setBusy(false)

    if (error) {
      setMessage('Código inválido ou expirado. Abra o Google Authenticator e informe o código atual.')
      setCode('')
      return
    }

    await hrxSupabase.auth.refreshSession()
    setCode('')
    setEnrollment(null)
    await evaluate()
  }

  if (phase === 'ready') return <>{children}</>

  if (phase === 'checking') return <main className="admin-login-shell"><section className="admin-login-card hrx-mfa-card"><div className="hrx-security-mark">HR</div><span className="eyebrow">HRX · SEGURANÇA</span><h1>Validando acesso</h1><p>Confirmando o nível de segurança da sessão administrativa.</p><div className="hrx-mfa-loading"><i /><span>Verificação em andamento…</span></div></section></main>

  if (phase === 'error') return <main className="admin-login-shell"><section className="admin-login-card hrx-mfa-card"><div className="hrx-security-mark">HR</div><span className="eyebrow">HRX · SEGURANÇA</span><h1>Acesso não validado</h1><p>{message}</p><button className="button button-primary" type="button" onClick={() => void evaluate()}>Tentar novamente</button><button className="admin-recovery-button" type="button" onClick={() => void hrxSupabase.auth.signOut()}>Sair da conta</button></section></main>

  if (phase === 'enroll') return <main className="admin-login-shell"><section className="admin-login-card hrx-mfa-card"><div className="hrx-security-mark">2FA</div><span className="eyebrow">HRX · PRIMEIRO ACESSO SEGURO</span><h1>Proteja o HRX Admin</h1><p>Antes de abrir dados internos, ative a verificação em duas etapas. O acesso passará a exigir um código temporário do Google Authenticator ou de outro aplicativo TOTP compatível.</p><div className="hrx-mfa-security-list"><span><i>1</i>Escaneie um QR Code no autenticador</span><span><i>2</i>Informe o código de 6 dígitos</span><span><i>3</i>O painel só abre com sessão AAL2</span></div><button className="button button-primary" type="button" disabled={busy} onClick={() => void startEnrollment()}>{busy ? 'Preparando…' : 'Configurar Google Authenticator'}</button><button className="admin-recovery-button" type="button" onClick={() => void hrxSupabase.auth.signOut()}>Sair da conta</button></section></main>

  if (phase === 'enrolling' && !enrollment) return <main className="admin-login-shell"><section className="admin-login-card hrx-mfa-card"><div className="hrx-security-mark">2FA</div><h1>Preparando autenticador</h1><p>Gerando uma credencial exclusiva para esta conta.</p><div className="hrx-mfa-loading"><i /><span>Aguarde…</span></div></section></main>

  if (enrollment) return <main className="admin-login-shell"><form className="admin-login-card hrx-mfa-card hrx-mfa-enrollment" onSubmit={verify}><span className="eyebrow">HRX · GOOGLE AUTHENTICATOR</span><h1>Conectar autenticador</h1><p>Escaneie o QR Code. Se estiver configurando no mesmo aparelho, use a chave manual abaixo.</p><div className="hrx-mfa-qr" dangerouslySetInnerHTML={{ __html: enrollment.qrCode }} /><div className="hrx-mfa-secret"><span>CHAVE MANUAL</span><strong>{enrollment.secret}</strong></div><label className="admin-field">Código de 6 dígitos<input autoFocus required inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>{message && <div className="admin-login-message is-error" role="alert">{message}</div>}<button className="button button-primary" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Validando…' : 'Ativar verificação'}</button><button className="admin-recovery-button" type="button" onClick={() => void hrxSupabase.auth.signOut()}>Cancelar e sair</button></form></main>

  return <main className="admin-login-shell"><form className="admin-login-card hrx-mfa-card" onSubmit={verify}><div className="hrx-security-mark">2FA</div><span className="eyebrow">HRX · VERIFICAÇÃO EM DUAS ETAPAS</span><h1>Confirme sua identidade</h1><p>Abra o Google Authenticator e informe o código atual para continuar para o HRX Admin.</p><label className="admin-field">Código do autenticador<input autoFocus required inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>{message && <div className="admin-login-message is-error" role="alert">{message}</div>}<button className="button button-primary" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Verificando…' : 'Verificar e entrar'}</button><button className="admin-recovery-button" type="button" onClick={() => void hrxSupabase.auth.signOut()}>Usar outra conta</button></form></main>
}
