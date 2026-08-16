import { FormEvent, useMemo, useState } from 'react'
import { isQuoteEndpointConfigured, submitQuoteRequest } from './api'
import type { ContactReason, PreferredContact, QuoteRequestPayload, ServiceInterest } from './types'
import './quotes.css'

const serviceOptions: { value: ServiceInterest; label: string }[] = [
  { value: 'gestao', label: 'Gestão' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'documentacao', label: 'Documentação' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'nao_sei', label: 'Ainda não sei' },
]

export default function QuoteRequestForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [protocol, setProtocol] = useState('')
  const [error, setError] = useState('')
  const [interests, setInterests] = useState<ServiceInterest[]>([])
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const endpointReady = useMemo(() => isQuoteEndpointConfigured(), [])

  const toggleInterest = (value: ServiceInterest) => {
    setInterests((current) => {
      if (value === 'nao_sei') return current.includes(value) ? [] : ['nao_sei']
      const withoutUnknown = current.filter((item) => item !== 'nao_sei')
      return withoutUnknown.includes(value)
        ? withoutUnknown.filter((item) => item !== value)
        : [...withoutUnknown, value]
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const form = new FormData(event.currentTarget)
    const request = String(form.get('request') ?? '').trim()

    if (interests.length === 0) {
      setError('Selecione ao menos uma área de interesse ou marque “Ainda não sei”.')
      return
    }

    if (request.length < 20) {
      setError('Conte um pouco mais sobre o que você precisa para conseguirmos analisar a solicitação.')
      return
    }

    if (!privacyConsent) {
      setError('É necessário aceitar a Política de Privacidade para enviar a solicitação.')
      return
    }

    const payload: QuoteRequestPayload = {
      name: String(form.get('name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      company: String(form.get('company') ?? '').trim() || undefined,
      reason: String(form.get('reason') ?? 'orcamento') as ContactReason,
      interests,
      request,
      desiredDeadline: String(form.get('desiredDeadline') ?? '').trim() || undefined,
      preferredContact: String(form.get('preferredContact') ?? 'whatsapp') as PreferredContact,
      privacyConsent: true,
      marketingConsent: form.get('marketingConsent') === 'on',
      source: 'website',
    }

    setStatus('sending')

    try {
      const result = await submitQuoteRequest(payload)
      setProtocol(result.protocol)
      setStatus('success')
      event.currentTarget.reset()
      setInterests([])
      setPrivacyConsent(false)
    } catch (submitError) {
      setStatus('error')
      if (submitError instanceof Error && submitError.message === 'QUOTE_ENDPOINT_NOT_CONFIGURED') {
        setError('O canal seguro de envio ainda está em configuração. Nenhum dado foi armazenado.')
      } else {
        setError('Não foi possível enviar agora. Tente novamente em alguns instantes.')
      }
    }
  }

  if (status === 'success') {
    return (
      <div className="quote-success" role="status">
        <span className="quote-success-mark">✓</span>
        <p className="eyebrow">SOLICITAÇÃO RECEBIDA</p>
        <h3>Agora a análise é com a HRX.</h3>
        <p>Vamos revisar sua necessidade antes de qualquer proposta comercial. Nenhum valor é gerado ou enviado automaticamente.</p>
        {protocol && <p className="quote-protocol">Protocolo: <strong>{protocol}</strong></p>}
        <button className="button button-secondary" type="button" onClick={() => setStatus('idle')}>Enviar outra solicitação</button>
      </div>
    )
  }

  return (
    <form className="contact-form quote-form" onSubmit={handleSubmit}>
      <div className="quote-form-header">
        <span className="quote-step">Solicitação de proposta</span>
        <p>Descreva sua necessidade. O pedido será analisado internamente antes de qualquer orçamento ou contato comercial.</p>
      </div>

      <div className="form-row">
        <label>Nome completo<input type="text" name="name" autoComplete="name" required /></label>
        <label>E-mail<input type="email" name="email" autoComplete="email" required /></label>
      </div>

      <div className="form-row">
        <label>Telefone / WhatsApp<input type="tel" name="phone" autoComplete="tel" required /></label>
        <label>Empresa <span className="optional">opcional</span><input type="text" name="company" autoComplete="organization" /></label>
      </div>

      <div className="form-row">
        <label>Motivo do contato
          <select name="reason" defaultValue="orcamento">
            <option value="orcamento">Solicitar proposta</option>
            <option value="projeto">Tenho um projeto em mente</option>
            <option value="automacao">Quero automatizar um processo</option>
            <option value="consultoria">Preciso organizar uma operação</option>
            <option value="outro">Outro assunto</option>
          </select>
        </label>
        <label>Prazo desejado <span className="optional">opcional</span><input type="text" name="desiredDeadline" placeholder="Ex.: ainda este mês" /></label>
      </div>

      <fieldset className="interest-fieldset">
        <legend>O que você acredita que precisa?</legend>
        <div className="interest-options">
          {serviceOptions.map((option) => (
            <label className={interests.includes(option.value) ? 'interest-chip is-selected' : 'interest-chip'} key={option.value}>
              <input type="checkbox" checked={interests.includes(option.value)} onChange={() => toggleInterest(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>Conte o que você precisa
        <textarea name="request" rows={6} required minLength={20} placeholder="Explique o problema, como funciona hoje e o que você gostaria de melhorar. Quanto mais contexto, melhor será a análise." />
      </label>

      <fieldset className="contact-preference">
        <legend>Como prefere receber nosso retorno?</legend>
        <label><input type="radio" name="preferredContact" value="whatsapp" defaultChecked /> WhatsApp</label>
        <label><input type="radio" name="preferredContact" value="email" /> E-mail</label>
      </fieldset>

      <div className="privacy-box">
        <details className="privacy-details" id="politica-de-privacidade">
          <summary>Política de Privacidade — resumo do formulário</summary>
          <p>Os dados informados serão usados para receber, analisar e responder sua solicitação, manter o histórico comercial necessário ao atendimento e registrar o consentimento apresentado no envio.</p>
          <p>O consentimento para novidades é opcional e separado da solicitação de proposta. Antes da publicação definitiva, a HRX disponibilizará o canal formal para solicitações relacionadas aos dados pessoais e a versão completa desta política.</p>
        </details>
        <label className="privacy-check">
          <input type="checkbox" checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} required />
          <span>Li a Política de Privacidade acima e autorizo o uso dos dados enviados para análise desta solicitação e retorno de contato.</span>
        </label>
        <label className="privacy-check privacy-optional">
          <input type="checkbox" name="marketingConsent" />
          <span>Quero receber novidades e conteúdos da HRX. <strong>Opcional.</strong></span>
        </label>
        <small>Os consentimentos são registrados separadamente. A autorização de marketing não é necessária para solicitar uma proposta.</small>
      </div>

      {error && <div className="quote-error" role="alert">{error}</div>}

      <button type="submit" className="button button-primary form-button" disabled={status === 'sending'}>
        {status === 'sending' ? 'Enviando…' : 'Enviar para análise'} <span>→</span>
      </button>

      {!endpointReady && <small className="quote-dev-note">Ambiente em configuração: o envio permanecerá seguro e não armazenará dados até o backend estar conectado.</small>}
    </form>
  )
}
