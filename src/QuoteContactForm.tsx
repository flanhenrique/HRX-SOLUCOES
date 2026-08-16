import { FormEvent, useState } from 'react'

const QUOTE_ENDPOINT = 'https://tgcdkofplegmjvvkheyd.supabase.co/functions/v1/quote-intake'
const PUBLISHABLE_KEY = 'sb_publishable_v9RLT-Cdlgsfu8PBJOfoIw_h_eLTDhC'

type SubmitState = 'idle' | 'sending' | 'success' | 'error'

type QuoteResponse = {
  requestId?: string
  protocol?: string
  status?: string
  error?: string
}

export default function QuoteContactForm() {
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [protocol, setProtocol] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitState === 'sending') return

    const form = event.currentTarget
    const data = new FormData(form)
    const privacyConsent = data.get('privacyConsent') === 'on'

    if (!privacyConsent) {
      setErrorMessage('Confirme a autorização de uso dos dados para que a HRX possa analisar e responder sua solicitação.')
      setSubmitState('error')
      return
    }

    setSubmitState('sending')
    setErrorMessage('')

    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      company: String(data.get('company') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim(),
      request: String(data.get('message') ?? '').trim(),
      reason: 'orcamento',
      interests: ['nao_sei'],
      preferredContact: 'whatsapp',
      privacyConsent: true,
      marketingConsent: false,
      source: 'website',
    }

    try {
      const response = await fetch(QUOTE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: PUBLISHABLE_KEY,
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => ({})) as QuoteResponse
      if (!response.ok) {
        const friendlyErrors: Record<string, string> = {
          invalid_payload: 'Revise os campos obrigatórios e descreva sua necessidade com um pouco mais de detalhe.',
          invalid_email: 'Informe um e-mail válido para receber o retorno da HRX.',
          rate_limited: 'Recebemos solicitações recentes com este e-mail. Aguarde alguns minutos antes de tentar novamente.',
          origin_not_allowed: 'O canal de envio está sendo atualizado. Tente novamente em instantes.',
        }
        throw new Error(friendlyErrors[result.error ?? ''] ?? 'Não foi possível registrar sua solicitação agora.')
      }

      setProtocol(result.protocol ?? '')
      setSubmitState('success')
      form.reset()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível registrar sua solicitação agora.')
      setSubmitState('error')
    }
  }

  const closeSuccess = () => {
    setSubmitState('idle')
    setProtocol('')
  }

  return (
    <>
      <form className="contact-form executive-form" onSubmit={submit} noValidate={false}>
        <div className="form-intro-row">
          <div>
            <span className="form-step">01 · CONTEXTO</span>
            <strong>Solicitação de proposta</strong>
          </div>
          <span className="form-security">Análise humana antes do preço</span>
        </div>

        <div className="form-row">
          <label>Nome completo<input required type="text" name="name" autoComplete="name" /></label>
          <label>E-mail<input required type="email" name="email" autoComplete="email" /></label>
        </div>
        <div className="form-row">
          <label>Empresa <small>opcional</small><input type="text" name="company" autoComplete="organization" /></label>
          <label>Telefone / WhatsApp<input required type="tel" name="phone" autoComplete="tel" /></label>
        </div>
        <label>Como podemos ajudar?<textarea required minLength={20} name="message" rows={5} placeholder="Explique o cenário atual, o que precisa melhorar e, se souber, o prazo desejado." /></label>

        <label className="privacy-check">
          <input required type="checkbox" name="privacyConsent" />
          <span>Autorizo a HRX Solutions a utilizar estes dados exclusivamente para analisar esta solicitação e entrar em contato, conforme a LGPD.</span>
        </label>

        {submitState === 'error' && <div className="form-feedback form-feedback-error" role="alert">{errorMessage}</div>}

        <div className="form-submit-row">
          <button type="submit" className="button button-primary form-button" disabled={submitState === 'sending'}>
            {submitState === 'sending' ? 'Enviando solicitação…' : 'Enviar para análise'} <span>{submitState === 'sending' ? '···' : '→'}</span>
          </button>
          <small>Você não recebe preço automático. A proposta só é enviada depois da validação da HRX.</small>
        </div>
      </form>

      {submitState === 'success' && (
        <div className="success-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeSuccess() }}>
          <section className="success-dialog" role="dialog" aria-modal="true" aria-labelledby="success-title">
            <div className="success-mark" aria-hidden="true">✓</div>
            <p className="eyebrow">SOLICITAÇÃO RECEBIDA</p>
            <h3 id="success-title">Sua demanda entrou para análise.</h3>
            <p>A HRX vai revisar as informações antes de definir escopo, prazo e proposta. O retorno será feito pelos canais informados.</p>
            {protocol && <div className="protocol-box"><span>Protocolo</span><strong>{protocol}</strong></div>}
            <button className="button button-primary" type="button" onClick={closeSuccess}>Concluir <span>→</span></button>
          </section>
        </div>
      )}
    </>
  )
}
