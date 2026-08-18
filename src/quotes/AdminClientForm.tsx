import { FormEvent, useState } from 'react'
import { hrxSupabase } from './supabaseClient'

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

  return <div className="admin-ops-modal-backdrop">
    <form className="admin-ops-modal" onSubmit={submit}>
      <header><div><span>NOVO CADASTRO</span><h3>Adicionar cliente</h3></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      {error && <div className="admin-ops-error">{error}</div>}
      <div className="admin-ops-form-grid">
        <label>Nome / responsável<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Empresa<input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label>
        <label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Telefone / WhatsApp<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="is-wide">CPF/CNPJ
          <div className="hrx-cnpj-inline"><input value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })} /><button type="button" onClick={() => void lookupCnpj()} disabled={cnpjBusy}>{cnpjBusy ? 'Consultando…' : 'Consultar CNPJ'}</button></div>
          <small>{cnpjMessage}</small>
          {cnpjResult && <div className="hrx-cnpj-result"><strong>{cnpjResult.legalName || cnpjResult.tradeName}</strong><span>{cnpjResult.status || 'Situação não informada'}{cnpjResult.city ? ` · ${cnpjResult.city}/${cnpjResult.state}` : ''}</span><em>Fonte automática: {cnpjResult.source}</em>{cnpjResult.sefazVerificationUrl && <a href={cnpjResult.sefazVerificationUrl} target="_blank" rel="noreferrer">Verificar cadastro na SEFAZ/AM ↗</a>}</div>}
        </label>
        <label className="is-wide">Observações<textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <footer><button type="button" onClick={onClose}>Cancelar</button><button className="is-primary" disabled={busy || !form.name || (!form.email && !form.phone)} type="submit">{busy ? 'Salvando…' : 'Salvar cliente'}</button></footer>
    </form>
  </div>
}
