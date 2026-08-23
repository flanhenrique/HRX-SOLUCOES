import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'
import './admin-client-form.css'

type ClientFormState = {
  name: string
  company: string
  email: string
  phone: string
  document: string
  notes: string
}

type CnpjLookup = {
  cnpj: string
  legalName: string
  tradeName: string
  status: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  cnaeCode?: string | number | null
  cnaeDescription: string
  source: string
  sefazVerificationUrl?: string | null
  checkedAt: string
}

const initialForm: ClientFormState = { name: '', company: '', email: '', phone: '', document: '', notes: '' }

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length !== 14) return digits
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function fiscalNotes(data: CnpjLookup, current: string) {
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

export default function AdminClientForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id?: string) => Promise<void> | void }) {
  const [form, setForm] = useState<ClientFormState>(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cnpjBusy, setCnpjBusy] = useState(false)
  const [cnpjMessage, setCnpjMessage] = useState('Preencha o CNPJ e use a consulta para completar os dados cadastrais.')
  const [cnpjResult, setCnpjResult] = useState<CnpjLookup | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => nameInput.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !cnpjBusy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [busy, cnpjBusy, onClose])

  const lookupCnpj = async () => {
    const cnpj = form.document.replace(/\D/g, '')
    if (cnpj.length !== 14) {
      setCnpjResult(null)
      setCnpjMessage('Informe um CNPJ com 14 dígitos para consultar.')
      return
    }

    setCnpjBusy(true)
    setCnpjMessage('Consultando cadastro…')
    const { data, error: lookupError } = await hrxSupabase.functions.invoke<CnpjLookup>('cnpj-lookup', { body: { cnpj } })
    setCnpjBusy(false)

    if (lookupError || !data) {
      setCnpjResult(null)
      setCnpjMessage('Não foi possível consultar este CNPJ agora. Confira o número e tente novamente.')
      return
    }

    setForm((current) => ({
      ...current,
      document: formatCnpj(data.cnpj),
      company: data.tradeName || data.legalName || current.company,
      name: current.name || data.legalName || data.tradeName || '',
      email: current.email || data.email || '',
      phone: current.phone || data.phone || '',
      notes: fiscalNotes(data, current.notes),
    }))
    setCnpjResult(data)
    setCnpjMessage('Dados encontrados e preenchidos. Revise antes de salvar o cliente.')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { data, error: rpcError } = await hrxSupabase.rpc('hrx_create_client', {
      p_name: form.name,
      p_company: form.company || null,
      p_email: form.email || null,
      p_phone: form.phone || null,
      p_document: form.document || null,
      p_notes: form.notes || null,
    })
    setBusy(false)

    if (rpcError) {
      const text = rpcError.message ?? ''
      setError(text.includes('duplicate_client') ? 'Já existe um cliente cadastrado com este e-mail.' : 'Não foi possível salvar este cliente agora.')
      return
    }

    await onCreated(typeof data === 'string' ? data : undefined)
    onClose()
  }

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !busy && !cnpjBusy) onClose()
  }

  const modal = <div className="admin-client-modal-backdrop" role="presentation" onMouseDown={closeFromBackdrop}>
    <form className="admin-client-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="admin-client-modal-title">
      <header className="admin-client-modal-header">
        <div><span>NOVO CADASTRO</span><h2 id="admin-client-modal-title">Adicionar cliente</h2><p>Cadastre os dados principais do cliente sem sair da carteira comercial.</p></div>
        <button type="button" className="admin-client-modal-close" onClick={onClose} aria-label="Fechar" disabled={busy || cnpjBusy}>×</button>
      </header>
      {error && <div className="admin-client-modal-error" role="alert">{error}</div>}
      <div className="admin-client-modal-body">
        <div className="admin-client-form-grid">
          <label>Nome / responsável<input ref={nameInput} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" /></label>
          <label>Empresa<input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} autoComplete="organization" /></label>
          <label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label>
          <label>Telefone / WhatsApp<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputMode="tel" autoComplete="tel" /></label>
          <label className="is-wide">CPF/CNPJ
            <div className="hrx-cnpj-inline"><input value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })} inputMode="numeric" /><button type="button" onClick={() => void lookupCnpj()} disabled={cnpjBusy}>{cnpjBusy ? 'Consultando…' : 'Consultar CNPJ'}</button></div>
            <small>{cnpjMessage}</small>
            {cnpjResult && <div className="hrx-cnpj-result"><strong>{cnpjResult.legalName || cnpjResult.tradeName}</strong><span>{cnpjResult.status || 'Situação não informada'}{cnpjResult.city ? ` · ${cnpjResult.city}/${cnpjResult.state}` : ''}</span><em>Fonte automática: {cnpjResult.source}</em>{cnpjResult.sefazVerificationUrl && <a href={cnpjResult.sefazVerificationUrl} target="_blank" rel="noreferrer">Verificar cadastro na SEFAZ/AM ↗</a>}</div>}
          </label>
          <label className="is-wide">Observações<textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        </div>
      </div>
      <footer className="admin-client-modal-footer"><button type="button" onClick={onClose} disabled={busy || cnpjBusy}>Cancelar</button><button className="is-primary" disabled={busy || cnpjBusy || !form.name || (!form.email && !form.phone)} type="submit">{busy ? 'Salvando…' : 'Salvar cliente'}</button></footer>
    </form>
  </div>

  return createPortal(modal, document.body)
}
