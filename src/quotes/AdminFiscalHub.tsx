import { FunctionsHttpError } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { hrxSupabase } from './supabaseClient'
import './admin-fiscal.css'

type ClientRow = {
  id: string
  name: string
  company?: string | null
  document?: string | null
  email?: string | null
  phone?: string | null
  active: boolean
}

type SecondaryCnae = {
  code?: string
  description?: string
}

type FiscalAddress = {
  street?: string
  number?: string
  complement?: string
  district?: string
  city?: string
  state?: string
  zipCode?: string
}

type FiscalProfile = {
  client_id: string
  cnpj: string
  legal_name?: string | null
  trade_name?: string | null
  registration_status?: string | null
  registration_status_date?: string | null
  registration_status_reason?: string | null
  main_cnae_code?: string | null
  main_cnae_description?: string | null
  secondary_cnaes?: SecondaryCnae[] | null
  legal_nature?: string | null
  company_size?: string | null
  simple_option?: boolean | null
  simple_start_date?: string | null
  simple_end_date?: string | null
  mei_option?: boolean | null
  mei_start_date?: string | null
  mei_end_date?: string | null
  tax_regime?: string | null
  tax_regime_requires_confirmation: boolean
  tax_regime_reference?: string | null
  tax_regime_reference_year?: number | null
  tax_regime_source?: string | null
  state_registration?: string | null
  state_registration_status?: string | null
  icms_taxpayer?: boolean | null
  federal_validation_status?: string | null
  state_validation_status?: string | null
  fiscal_address?: FiscalAddress | null
  data_source?: string | null
  data_source_official: boolean
  source_note?: string | null
  sefaz_verification_url?: string | null
  checked_at?: string | null
}

const manualRegimes = [
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'LUCRO_REAL', label: 'Lucro Real' },
  { value: 'IMUNE_ISENTA', label: 'Imune / Isenta' },
  { value: 'OUTRO', label: 'Outro' },
]

function onlyDigits(value?: string | null) {
  return String(value ?? '').replace(/\D/g, '')
}

function isCnpj(value?: string | null) {
  return onlyDigits(value).length === 14
}

function formatCnpj(value?: string | null) {
  const digits = onlyDigits(value)
  if (digits.length !== 14) return value || '—'
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '—'
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return withTime
    ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : date.toLocaleDateString('pt-BR')
}

function labelRegime(value?: string | null) {
  if (!value) return 'A confirmar'
  const known = manualRegimes.find((item) => item.value === value)?.label
  if (known) return known
  if (value === 'SIMPLES_NACIONAL') return 'Simples Nacional'
  if (value === 'MEI') return 'MEI / SIMEI'
  return value.replaceAll('_', ' ').toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}

function yesNoUnknown(value?: boolean | null) {
  if (value === true) return 'Sim'
  if (value === false) return 'Não'
  return 'Não informado'
}

function stateLabel(value?: string | null) {
  const labels: Record<string, string> = {
    PENDENTE_SEFAZ_AM: 'Pendente SEFAZ-AM',
    NAO_VERIFICADO: 'Não verificado',
    HABILITADO: 'Habilitado',
    NAO_HABILITADO: 'Não habilitado',
  }
  return value ? labels[value] ?? value.replaceAll('_', ' ') : 'Não verificado'
}

async function lookupErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const payload = await error.context.json().catch(() => ({})) as { error?: string }
    const messages: Record<string, string> = {
      invalid_cnpj: 'O documento deste cliente não é um CNPJ válido.',
      cnpj_not_found: 'O CNPJ não foi localizado na base pública consultada.',
      lookup_unavailable: 'A consulta pública do CNPJ está indisponível no momento.',
      client_not_found: 'O cliente não foi localizado no cadastro.',
      client_cnpj_mismatch: 'O CNPJ informado não corresponde ao documento salvo no cliente.',
      fiscal_profile_save_failed: 'A consulta funcionou, mas o perfil fiscal não pôde ser gravado.',
      forbidden: 'Seu usuário não tem permissão para consultar dados fiscais.',
    }
    return messages[payload.error ?? ''] ?? 'Não foi possível atualizar a situação fiscal.'
  }
  return error instanceof Error ? error.message : 'Não foi possível atualizar a situação fiscal.'
}

export default function AdminFiscalHub() {
  const [sidebarTarget, setSidebarTarget] = useState<Element | null>(null)
  const [mobileTarget, setMobileTarget] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, FiscalProfile>>({})
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyClientId, setBusyClientId] = useState<string | null>(null)
  const [savingRegime, setSavingRegime] = useState(false)
  const [manualRegime, setManualRegime] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'info' | 'success' | 'error'>('info')

  useEffect(() => {
    const updateTargets = () => {
      setSidebarTarget(document.querySelector('.admin-exec-sidebar nav'))
      setMobileTarget(document.querySelector('.admin-mobile-nav'))
    }
    updateTargets()
    const observer = new MutationObserver(updateTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const loadData = async (preferredClientId?: string) => {
    setLoading(true)
    setMessage('')
    try {
      const [clientsResult, profilesResult] = await Promise.all([
        hrxSupabase.from('clients').select('id,name,company,document,email,phone,active').eq('active', true).order('name'),
        hrxSupabase.from('client_fiscal_profiles').select('*'),
      ])
      if (clientsResult.error) throw clientsResult.error
      if (profilesResult.error) throw profilesResult.error

      const cnpjClients = ((clientsResult.data ?? []) as ClientRow[]).filter((client) => isCnpj(client.document))
      const fiscalProfiles = ((profilesResult.data ?? []) as FiscalProfile[]).reduce<Record<string, FiscalProfile>>((acc, item) => {
        acc[item.client_id] = item
        return acc
      }, {})

      setClients(cnpjClients)
      setProfiles(fiscalProfiles)
      setSelectedClientId((current) => {
        if (preferredClientId && cnpjClients.some((item) => item.id === preferredClientId)) return preferredClientId
        if (current && cnpjClients.some((item) => item.id === current)) return current
        return cnpjClients[0]?.id ?? null
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os dados fiscais.')
      setMessageTone('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void loadData()
  }, [open])

  const selectedClient = clients.find((item) => item.id === selectedClientId) ?? null
  const selectedProfile = selectedClient ? profiles[selectedClient.id] ?? null : null

  useEffect(() => {
    setManualRegime(selectedProfile?.tax_regime_requires_confirmation ? '' : selectedProfile?.tax_regime ?? '')
  }, [selectedClientId, selectedProfile?.tax_regime, selectedProfile?.tax_regime_requires_confirmation])

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalized) return clients
    return clients.filter((client) => {
      const profile = profiles[client.id]
      return [client.name, client.company, client.document, profile?.legal_name, profile?.trade_name, profile?.registration_status, profile?.tax_regime]
        .some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(normalized))
    })
  }, [clients, profiles, query])

  const refreshClient = async (client: ClientRow) => {
    setBusyClientId(client.id)
    setMessage('')
    try {
      const { error } = await hrxSupabase.functions.invoke('cnpj-lookup', { body: { clientId: client.id } })
      if (error) throw error
      await loadData(client.id)
      setMessage('Dados cadastrais e tributários públicos atualizados.')
      setMessageTone('success')
    } catch (error) {
      setMessage(await lookupErrorMessage(error))
      setMessageTone('error')
    } finally {
      setBusyClientId(null)
    }
  }

  const confirmTaxRegime = async () => {
    if (!selectedClient || !manualRegime) return
    setSavingRegime(true)
    setMessage('')
    try {
      const { error } = await hrxSupabase.rpc('hrx_confirm_client_tax_regime', {
        p_client_id: selectedClient.id,
        p_tax_regime: manualRegime,
      })
      if (error) throw error
      await loadData(selectedClient.id)
      setMessage('Regime tributário confirmado manualmente.')
      setMessageTone('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível confirmar o regime tributário.')
      setMessageTone('error')
    } finally {
      setSavingRegime(false)
    }
  }

  const sidebarPortal = sidebarTarget ? createPortal(
    <button type="button" className="admin-fiscal-nav" onClick={() => setOpen(true)}>
      <span aria-hidden="true">◇</span>Fiscal
    </button>,
    sidebarTarget,
  ) : null

  const mobilePortal = mobileTarget ? createPortal(
    <button type="button" className="admin-fiscal-mobile" onClick={() => setOpen(true)}>
      <span aria-hidden="true">◇</span>Fiscal
    </button>,
    mobileTarget,
  ) : null

  const address = selectedProfile?.fiscal_address
  const addressText = address
    ? [[address.street, address.number].filter(Boolean).join(', '), address.complement, address.district, [address.city, address.state].filter(Boolean).join(' - '), address.zipCode ? `CEP ${address.zipCode}` : ''].filter(Boolean).join(' · ')
    : 'Não consultado'
  const secondaryCnaes = Array.isArray(selectedProfile?.secondary_cnaes) ? selectedProfile.secondary_cnaes : []

  return <>
    {sidebarPortal}{mobilePortal}

    {open && <section className="admin-fiscal-shell" role="dialog" aria-modal="true" aria-label="Gestão fiscal de clientes">
      <header className="admin-fiscal-header">
        <div><span>HRX · BACKOFFICE</span><h2>Fiscal</h2><p>Validação cadastral e tributária por CNPJ</p></div>
        <div className="admin-fiscal-header-actions"><span>{clients.length} cliente(s) PJ</span><button type="button" aria-label="Fechar" onClick={() => setOpen(false)}>×</button></div>
      </header>

      {message && <div className={`admin-fiscal-message is-${messageTone}`}>{message}</div>}

      <div className="admin-fiscal-layout">
        <aside className="admin-fiscal-clients">
          <div className="admin-fiscal-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empresa ou CNPJ" /></div>
          <div className="admin-fiscal-client-list">
            {loading && <p className="admin-fiscal-empty">Carregando clientes…</p>}
            {!loading && filteredClients.length === 0 && <p className="admin-fiscal-empty">Nenhum cliente com CNPJ cadastrado.</p>}
            {!loading && filteredClients.map((client) => {
              const profile = profiles[client.id]
              const active = profile?.registration_status === 'ATIVA'
              return <button key={client.id} type="button" className={selectedClientId === client.id ? 'admin-fiscal-client is-active' : 'admin-fiscal-client'} onClick={() => setSelectedClientId(client.id)}>
                <div><strong>{client.company || profile?.trade_name || client.name}</strong><span className={active ? 'is-good' : profile ? 'is-warning' : 'is-muted'}>{profile ? profile.registration_status || 'Verificar' : 'Não consultado'}</span></div>
                <small>{client.name}</small>
                <time>{formatCnpj(client.document)}</time>
              </button>
            })}
          </div>
        </aside>

        <main className="admin-fiscal-detail">
          {!selectedClient && <div className="admin-fiscal-empty-state"><strong>Nenhum cliente PJ selecionado</strong><p>Cadastre um CNPJ no catálogo de clientes para habilitar a análise fiscal.</p></div>}

          {selectedClient && <>
            <section className="admin-fiscal-title">
              <div><span>CLIENTE · {formatCnpj(selectedClient.document)}</span><h3>{selectedProfile?.legal_name || selectedClient.company || selectedClient.name}</h3><p>{selectedProfile?.trade_name || selectedClient.company || 'Nome fantasia não informado'}</p></div>
              <button type="button" className="is-primary" disabled={busyClientId === selectedClient.id} onClick={() => void refreshClient(selectedClient)}>{busyClientId === selectedClient.id ? 'Consultando…' : selectedProfile ? '↻ Atualizar situação fiscal' : 'Consultar CNPJ'}</button>
            </section>

            {!selectedProfile && <section className="admin-fiscal-first-check"><div><span>CONSULTA INICIAL</span><h4>Este CNPJ ainda não possui perfil fiscal.</h4><p>A consulta preenche situação cadastral, Simples/MEI, CNAEs, natureza jurídica, porte e endereço fiscal.</p></div><button type="button" disabled={busyClientId === selectedClient.id} onClick={() => void refreshClient(selectedClient)}>Consultar agora</button></section>}

            {selectedProfile && <>
              <section className="admin-fiscal-validation-grid">
                <article><span>Federal</span><strong className={selectedProfile.registration_status === 'ATIVA' ? 'is-good' : 'is-warning'}>{selectedProfile.registration_status || 'Não verificado'}</strong><small>{selectedProfile.registration_status_date ? `desde ${formatDate(selectedProfile.registration_status_date)}` : 'situação cadastral'}</small></article>
                <article><span>Simples Nacional</span><strong>{yesNoUnknown(selectedProfile.simple_option)}</strong><small>{selectedProfile.simple_start_date ? `opção em ${formatDate(selectedProfile.simple_start_date)}` : 'base pública do CNPJ'}</small></article>
                <article><span>MEI / SIMEI</span><strong>{yesNoUnknown(selectedProfile.mei_option)}</strong><small>{selectedProfile.mei_start_date ? `opção em ${formatDate(selectedProfile.mei_start_date)}` : 'base pública do CNPJ'}</small></article>
                <article><span>Última atualização</span><strong>{formatDate(selectedProfile.checked_at, true)}</strong><small>{selectedProfile.data_source || 'Fonte pública'}</small></article>
              </section>

              <div className="admin-fiscal-cards">
                <section className="admin-fiscal-card">
                  <header><div><span>CADASTRO FEDERAL</span><h4>Situação do CNPJ</h4></div><b className={selectedProfile.registration_status === 'ATIVA' ? 'is-good' : 'is-warning'}>{selectedProfile.federal_validation_status === 'REGULAR_CADASTRALMENTE' ? 'Regular cadastralmente' : 'Atenção'}</b></header>
                  <dl><div><dt>Situação</dt><dd>{selectedProfile.registration_status || '—'}</dd></div><div><dt>Data</dt><dd>{formatDate(selectedProfile.registration_status_date)}</dd></div><div><dt>Motivo</dt><dd>{selectedProfile.registration_status_reason || 'Sem motivo informado'}</dd></div><div><dt>Natureza jurídica</dt><dd>{selectedProfile.legal_nature || '—'}</dd></div><div><dt>Porte</dt><dd>{selectedProfile.company_size || '—'}</dd></div></dl>
                </section>

                <section className="admin-fiscal-card">
                  <header><div><span>TRIBUTAÇÃO</span><h4>Regime tributário</h4></div><b className={selectedProfile.tax_regime_requires_confirmation ? 'is-warning' : 'is-good'}>{selectedProfile.tax_regime_requires_confirmation ? 'Confirmar' : 'Definido'}</b></header>
                  <div className="admin-fiscal-regime"><strong>{labelRegime(selectedProfile.tax_regime)}</strong><small>{selectedProfile.tax_regime_source === 'manual_admin' ? 'Confirmado por usuário administrativo.' : selectedProfile.tax_regime ? 'Identificado automaticamente pelos indicadores públicos.' : 'Não será inferido apenas porque a empresa não está no Simples.'}</small></div>
                  {selectedProfile.tax_regime_reference && <div className="admin-fiscal-reference"><span>Referência histórica disponível</span><strong>{selectedProfile.tax_regime_reference}{selectedProfile.tax_regime_reference_year ? ` · ${selectedProfile.tax_regime_reference_year}` : ''}</strong></div>}
                  {selectedProfile.tax_regime_requires_confirmation && <div className="admin-fiscal-confirm"><select value={manualRegime} onChange={(event) => setManualRegime(event.target.value)}><option value="">Selecione o regime atual</option>{manualRegimes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type="button" disabled={!manualRegime || savingRegime} onClick={() => void confirmTaxRegime()}>{savingRegime ? 'Salvando…' : 'Confirmar regime'}</button></div>}
                </section>

                <section className="admin-fiscal-card">
                  <header><div><span>ATIVIDADE ECONÔMICA</span><h4>CNAE</h4></div><b>{secondaryCnaes.length + 1} atividade(s)</b></header>
                  <div className="admin-fiscal-main-cnae"><span>{selectedProfile.main_cnae_code || '—'}</span><strong>{selectedProfile.main_cnae_description || 'CNAE principal não informado'}</strong></div>
                  {secondaryCnaes.length > 0 && <div className="admin-fiscal-secondary-cnaes">{secondaryCnaes.slice(0, 5).map((item, index) => <div key={`${item.code}-${index}`}><span>{item.code || '—'}</span><p>{item.description || 'Sem descrição'}</p></div>)}{secondaryCnaes.length > 5 && <small>+ {secondaryCnaes.length - 5} CNAE(s) secundário(s)</small>}</div>}
                </section>

                <section className="admin-fiscal-card">
                  <header><div><span>ENDEREÇO FISCAL</span><h4>Domicílio cadastral</h4></div><b>{address?.state || '—'}</b></header>
                  <p className="admin-fiscal-address">{addressText}</p>
                </section>

                <section className="admin-fiscal-card is-wide">
                  <header><div><span>CADASTRO ESTADUAL</span><h4>Inscrição Estadual / ICMS</h4></div><b className={selectedProfile.state_validation_status === 'HABILITADO' ? 'is-good' : 'is-warning'}>{stateLabel(selectedProfile.state_validation_status)}</b></header>
                  <div className="admin-fiscal-state-grid"><div><span>Inscrição Estadual</span><strong>{selectedProfile.state_registration || 'Não consultada automaticamente'}</strong></div><div><span>Situação IE</span><strong>{selectedProfile.state_registration_status || 'Pendente'}</strong></div><div><span>Contribuinte ICMS</span><strong>{yesNoUnknown(selectedProfile.icms_taxpayer)}</strong></div></div>
                  {selectedProfile.sefaz_verification_url && <div className="admin-fiscal-sefaz"><p>A SEFAZ-AM mantém consulta pública própria com validação de segurança. A informação estadual não é inferida pela consulta federal.</p><a href={selectedProfile.sefaz_verification_url} target="_blank" rel="noreferrer">Abrir consulta oficial SEFAZ-AM ↗</a></div>}
                </section>
              </div>

              <section className="admin-fiscal-source-note"><strong>Escopo da validação</strong><p>{selectedProfile.source_note || 'Os dados desta tela são cadastrais. Regularidade por certidão negativa é uma verificação separada.'}</p><span>Fonte automática: {selectedProfile.data_source || 'base pública do CNPJ'} · {selectedProfile.data_source_official ? 'fonte oficial integrada' : 'integração pública não oficial'}</span></section>
            </>}
          </>}
        </main>
      </div>
    </section>}
  </>
}
