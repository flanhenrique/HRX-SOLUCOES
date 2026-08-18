import { FunctionsHttpError } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { onAdminNavigate } from './adminNavigation'
import { hrxSupabase } from './supabaseClient'
import './admin-fiscal-page.css'

type ClientRow = {
  id: string
  name: string
  company?: string | null
  document?: string | null
  active: boolean
}

type FiscalProfile = {
  client_id: string
  cnpj: string
  legal_name?: string | null
  trade_name?: string | null
  registration_status?: string | null
  main_cnae_code?: string | null
  main_cnae_description?: string | null
  simple_option?: boolean | null
  mei_option?: boolean | null
  tax_regime?: string | null
  tax_regime_requires_confirmation?: boolean | null
  state_registration?: string | null
  state_registration_status?: string | null
  icms_taxpayer?: boolean | null
  federal_validation_status?: string | null
  state_validation_status?: string | null
  data_source?: string | null
  source_note?: string | null
  checked_at?: string | null
  sefaz_verification_url?: string | null
}

const regimes = [
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'LUCRO_REAL', label: 'Lucro Real' },
  { value: 'IMUNE_ISENTA', label: 'Imune / Isenta' },
  { value: 'OUTRO', label: 'Outro' },
]

const stateStatuses = ['NAO_VERIFICADA', 'ATIVA', 'INATIVA', 'SUSPENSA', 'BAIXADA', 'PENDENTE']

function digits(value?: string | null) { return String(value ?? '').replace(/\D/g, '') }
function isCnpj(value?: string | null) { return digits(value).length === 14 }
function formatCnpj(value?: string | null) {
  const valueDigits = digits(value)
  return valueDigits.length === 14 ? valueDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : value || '—'
}
function formatDate(value?: string | null) {
  if (!value) return 'Não consultado'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function yesNo(value?: boolean | null) { return value === true ? 'Sim' : value === false ? 'Não' : 'Não informado' }
function regimeLabel(value?: string | null) {
  if (!value) return 'A confirmar'
  if (value === 'SIMPLES_NACIONAL') return 'Simples Nacional'
  if (value === 'MEI' || value === 'SIMEI') return 'MEI / SIMEI'
  return regimes.find((item) => item.value === value)?.label ?? value.replaceAll('_', ' ')
}
function stateValidation(status: string) {
  if (status === 'ATIVA') return 'HABILITADO'
  if (status === 'PENDENTE') return 'PENDENTE_SEFAZ_AM'
  if (!status || status === 'NAO_VERIFICADA') return 'NAO_VERIFICADO'
  return 'NAO_HABILITADO'
}

async function readableLookupError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const payload = await error.context.json().catch(() => ({})) as { error?: string }
    const messages: Record<string, string> = {
      invalid_cnpj: 'O documento deste cliente não é um CNPJ válido.',
      cnpj_not_found: 'O CNPJ não foi localizado na base consultada.',
      lookup_unavailable: 'A consulta pública do CNPJ está indisponível.',
      client_not_found: 'O cliente não foi localizado.',
      mfa_required: 'Confirme a verificação em duas etapas para acessar dados fiscais.',
      forbidden: 'Seu usuário não tem permissão para acessar dados fiscais.',
    }
    return messages[payload.error ?? ''] ?? 'Não foi possível atualizar a situação fiscal.'
  }
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação fiscal.'
}

export default function AdminFiscalPage() {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, FiscalProfile>>({})
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [manualRegime, setManualRegime] = useState('')
  const [stateRegistration, setStateRegistration] = useState('')
  const [stateRegistrationStatus, setStateRegistrationStatus] = useState('NAO_VERIFICADA')
  const [icmsTaxpayer, setIcmsTaxpayer] = useState<'unknown' | 'true' | 'false'>('unknown')

  useEffect(() => onAdminNavigate((destination) => {
    if (destination === 'fiscal') setOpen(true)
    if (destination === 'quotes' || destination === 'clients' || destination === 'suspensions' || destination === 'documents' || destination === 'panels') setOpen(false)
  }), [])

  const loadData = async (preferredClientId?: string) => {
    setLoading(true)
    setMessage('')
    try {
      const [clientsResult, profilesResult] = await Promise.all([
        hrxSupabase.from('clients').select('id,name,company,document,active').eq('active', true).order('name'),
        hrxSupabase.from('client_fiscal_profiles').select('client_id,cnpj,legal_name,trade_name,registration_status,main_cnae_code,main_cnae_description,simple_option,mei_option,tax_regime,tax_regime_requires_confirmation,state_registration,state_registration_status,icms_taxpayer,federal_validation_status,state_validation_status,data_source,source_note,checked_at,sefaz_verification_url'),
      ])
      if (clientsResult.error) throw clientsResult.error
      if (profilesResult.error) throw profilesResult.error

      const nextClients = ((clientsResult.data ?? []) as ClientRow[]).filter((client) => isCnpj(client.document))
      const nextProfiles = ((profilesResult.data ?? []) as FiscalProfile[]).reduce<Record<string, FiscalProfile>>((acc, profile) => {
        acc[profile.client_id] = profile
        return acc
      }, {})
      setClients(nextClients)
      setProfiles(nextProfiles)
      setSelectedClientId((current) => {
        if (preferredClientId && nextClients.some((client) => client.id === preferredClientId)) return preferredClientId
        if (current && nextClients.some((client) => client.id === current)) return current
        return nextClients[0]?.id ?? null
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os dados fiscais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) void loadData() }, [open])

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null
  const selectedProfile = selectedClient ? profiles[selectedClient.id] ?? null : null

  useEffect(() => {
    setManualRegime(selectedProfile?.tax_regime_requires_confirmation ? '' : selectedProfile?.tax_regime ?? '')
    setStateRegistration(selectedProfile?.state_registration ?? '')
    setStateRegistrationStatus(selectedProfile?.state_registration_status ?? 'NAO_VERIFICADA')
    setIcmsTaxpayer(selectedProfile?.icms_taxpayer === true ? 'true' : selectedProfile?.icms_taxpayer === false ? 'false' : 'unknown')
  }, [selectedClientId, selectedProfile?.tax_regime, selectedProfile?.tax_regime_requires_confirmation, selectedProfile?.state_registration, selectedProfile?.state_registration_status, selectedProfile?.icms_taxpayer])

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    if (!normalized) return clients
    return clients.filter((client) => {
      const profile = profiles[client.id]
      return [client.name, client.company, client.document, profile?.legal_name, profile?.trade_name, profile?.tax_regime]
        .some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(normalized))
    })
  }, [clients, profiles, query])

  const refreshSelected = async () => {
    if (!selectedClient) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await hrxSupabase.functions.invoke('cnpj-lookup', { body: { clientId: selectedClient.id } })
      if (error) throw error
      await loadData(selectedClient.id)
      setMessage('Dados cadastrais e tributários atualizados.')
    } catch (error) {
      setMessage(await readableLookupError(error))
    } finally {
      setBusy(false)
    }
  }

  const confirmRegime = async () => {
    if (!selectedClient || !manualRegime) return
    setBusy(true)
    setMessage('')
    const { error } = await hrxSupabase.rpc('hrx_confirm_client_tax_regime', { p_client_id: selectedClient.id, p_tax_regime: manualRegime })
    if (error) setMessage(await readableLookupError(error))
    else { await loadData(selectedClient.id); setMessage('Regime tributário confirmado.') }
    setBusy(false)
  }

  const saveState = async () => {
    if (!selectedClient || !selectedProfile) return
    setBusy(true)
    setMessage('')
    const { error } = await hrxSupabase.rpc('hrx_update_client_state_registration', {
      p_client_id: selectedClient.id,
      p_state_registration: stateRegistration.trim() || null,
      p_state_registration_status: stateRegistrationStatus,
      p_icms_taxpayer: icmsTaxpayer === 'unknown' ? null : icmsTaxpayer === 'true',
      p_state_validation_status: stateValidation(stateRegistrationStatus),
    })
    if (error) setMessage(await readableLookupError(error))
    else { await loadData(selectedClient.id); setMessage('Cadastro estadual atualizado.') }
    setBusy(false)
  }

  if (!open) return null

  return <section className="hrx-fiscal-page" role="dialog" aria-modal="true" aria-label="Gestão fiscal de clientes">
    <header className="hrx-fiscal-header">
      <div><span>HRX · FISCAL</span><h2>Gestão fiscal</h2><p>Consulta cadastral, regime tributário e situação estadual.</p></div>
      <div><button type="button" onClick={() => void loadData(selectedClientId ?? undefined)} disabled={loading}>{loading ? 'Atualizando…' : '↻ Atualizar'}</button><button type="button" aria-label="Fechar" onClick={() => setOpen(false)}>×</button></div>
    </header>

    {message && <div className="hrx-fiscal-message" role="status">{message}</div>}

    <div className="hrx-fiscal-layout">
      <aside className="hrx-fiscal-list">
        <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empresa ou CNPJ" /></label>
        <div>{loading && <p>Carregando clientes…</p>}{!loading && filteredClients.length === 0 && <p>Nenhum cliente PJ cadastrado.</p>}{filteredClients.map((client) => {
          const profile = profiles[client.id]
          return <button key={client.id} type="button" className={selectedClientId === client.id ? 'is-active' : ''} onClick={() => setSelectedClientId(client.id)}><strong>{client.company || profile?.trade_name || client.name}</strong><small>{client.name}</small><span>{formatCnpj(client.document)}</span></button>
        })}</div>
      </aside>

      <main className="hrx-fiscal-content">
        {!selectedClient && <div className="hrx-fiscal-empty"><strong>Nenhum cliente selecionado</strong><p>Cadastre um CNPJ em Clientes para habilitar a análise fiscal.</p></div>}
        {selectedClient && <>
          <section className="hrx-fiscal-title"><div><span>{formatCnpj(selectedClient.document)}</span><h3>{selectedProfile?.legal_name || selectedClient.company || selectedClient.name}</h3><p>{selectedProfile?.trade_name || selectedClient.company || 'Empresa sem nome fantasia informado'}</p></div><button type="button" onClick={() => void refreshSelected()} disabled={busy}>{busy ? 'Consultando…' : selectedProfile ? 'Atualizar consulta' : 'Consultar CNPJ'}</button></section>

          {!selectedProfile && <section className="hrx-fiscal-empty"><strong>Perfil fiscal ainda não consultado.</strong><p>Use “Consultar CNPJ” para criar o perfil cadastral e tributário.</p></section>}

          {selectedProfile && <>
            <section className="hrx-fiscal-metrics">
              <article><span>Situação</span><strong>{selectedProfile.registration_status || 'Não verificado'}</strong></article>
              <article><span>Simples Nacional</span><strong>{yesNo(selectedProfile.simple_option)}</strong></article>
              <article><span>MEI / SIMEI</span><strong>{yesNo(selectedProfile.mei_option)}</strong></article>
              <article><span>Última consulta</span><strong>{formatDate(selectedProfile.checked_at)}</strong></article>
            </section>

            <section className="hrx-fiscal-card"><header><div><span>REGIME TRIBUTÁRIO</span><h4>{regimeLabel(selectedProfile.tax_regime)}</h4></div><b>{selectedProfile.tax_regime_requires_confirmation ? 'Confirmação necessária' : 'Definido'}</b></header><p>{selectedProfile.source_note || `Fonte: ${selectedProfile.data_source || 'base pública do CNPJ'}`}</p>{selectedProfile.tax_regime_requires_confirmation && <div className="hrx-fiscal-form"><select value={manualRegime} onChange={(event) => setManualRegime(event.target.value)}><option value="">Selecione o regime atual</option>{regimes.map((regime) => <option key={regime.value} value={regime.value}>{regime.label}</option>)}</select><button type="button" onClick={() => void confirmRegime()} disabled={busy || !manualRegime}>Confirmar regime</button></div>}</section>

            <section className="hrx-fiscal-card"><header><div><span>ATIVIDADE ECONÔMICA</span><h4>{selectedProfile.main_cnae_code || 'CNAE não informado'}</h4></div></header><p>{selectedProfile.main_cnae_description || 'Descrição do CNAE não disponível.'}</p></section>

            <section className="hrx-fiscal-card"><header><div><span>INSCRIÇÃO ESTADUAL / ICMS</span><h4>{selectedProfile.state_registration || 'Não informada'}</h4></div><b>{selectedProfile.state_registration_status || 'Não verificada'}</b></header><div className="hrx-fiscal-form hrx-fiscal-state-form"><input aria-label="Inscrição Estadual" placeholder="Inscrição Estadual" value={stateRegistration} onChange={(event) => setStateRegistration(event.target.value)} /><select aria-label="Situação da Inscrição Estadual" value={stateRegistrationStatus} onChange={(event) => setStateRegistrationStatus(event.target.value)}>{stateStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select><select aria-label="Contribuinte ICMS" value={icmsTaxpayer} onChange={(event) => setIcmsTaxpayer(event.target.value as 'unknown' | 'true' | 'false')}><option value="unknown">ICMS não informado</option><option value="true">Contribuinte ICMS</option><option value="false">Não contribuinte ICMS</option></select><button type="button" onClick={() => void saveState()} disabled={busy}>Salvar cadastro estadual</button></div>{selectedProfile.sefaz_verification_url && <a href={selectedProfile.sefaz_verification_url} target="_blank" rel="noreferrer">Abrir consulta oficial SEFAZ-AM ↗</a>}</section>
          </>}
        </>}
      </main>
    </div>
  </section>
}
