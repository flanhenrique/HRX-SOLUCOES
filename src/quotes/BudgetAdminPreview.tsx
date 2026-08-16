import { useMemo, useState } from 'react'
import { applyDiscount, assessDiscount, DISCOUNT_LEVELS } from './discount'
import type { DiscountLevel, RetentionInput } from './types'
import './quotes.css'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const emptyRetentions: RetentionInput = { iss: 0, irrf: 0, pis: 0, cofins: 0, csll: 0, inss: 0 }

export default function BudgetAdminPreview() {
  const [baseAmount, setBaseAmount] = useState(1000)
  const [discount, setDiscount] = useState<DiscountLevel>(0)
  const [installments, setInstallments] = useState(1)
  const [boletoFee, setBoletoFee] = useState(0)
  const [provider, setProvider] = useState<'none' | 'nubank' | 'mercadopago'>('none')
  const [retentions, setRetentions] = useState<RetentionInput>(emptyRetentions)

  const assessment = assessDiscount(discount)
  const discounted = applyDiscount(baseAmount, discount)
  const paymentFees = provider === 'none' ? 0 : Math.max(0, boletoFee) * Math.max(1, installments)
  const retentionTotal = Object.values(retentions).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
  const amountWithPaymentFees = discounted.finalAmount + paymentFees
  const estimatedNet = amountWithPaymentFees * Math.max(0, 1 - retentionTotal / 100)

  const canApprove = useMemo(() => !assessment.blocked && retentionTotal < 100, [assessment.blocked, retentionTotal])

  const setRetention = (key: keyof RetentionInput, value: string) => {
    setRetentions((current) => ({ ...current, [key]: Number(value) || 0 }))
  }

  const whatsappText = encodeURIComponent('Olá! Aqui é da HRX Solutions. Recebemos sua solicitação e estou entrando em contato para validar alguns pontos antes de fechar a proposta.')

  return (
    <main className="admin-preview-shell">
      <section className="admin-preview-header">
        <div>
          <span className="eyebrow">AMBIENTE INTERNO · PROTÓTIPO</span>
          <h1>Revisão de orçamento</h1>
          <p>Esta tela só deve ser habilitada depois da autenticação administrativa e da conexão com o backend privado.</p>
        </div>
        <span className="admin-status">Aguardando validação</span>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <span className="admin-card-kicker">SOLICITAÇÃO</span>
          <h2>Cliente e necessidade</h2>
          <dl className="admin-data-list">
            <div><dt>Nome</dt><dd>Lead recebido pelo site</dd></div>
            <div><dt>Canal preferido</dt><dd>WhatsApp</dd></div>
            <div><dt>Interpretação</dt><dd>Serviço identificado pelo motor, sujeito à sua revisão.</dd></div>
            <div><dt>Confiança</dt><dd><span className="confidence-pill">Alta</span></dd></div>
          </dl>
          <a className="button button-secondary admin-whatsapp" href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noreferrer">Abrir resposta no WhatsApp ↗</a>
        </article>

        <article className="admin-card">
          <span className="admin-card-kicker">PRECIFICAÇÃO</span>
          <h2>Valor-base</h2>
          <label className="admin-field">Valor antes de desconto
            <input type="number" min="0" step="10" value={baseAmount} onChange={(event) => setBaseAmount(Number(event.target.value) || 0)} />
          </label>
          <div className="price-summary">
            <div><span>Base</span><strong>{currency.format(baseAmount)}</strong></div>
            <div><span>Desconto</span><strong>- {currency.format(discounted.discountAmount)}</strong></div>
            <div className="price-total"><span>Após desconto</span><strong>{currency.format(discounted.finalAmount)}</strong></div>
          </div>
        </article>

        <article className="admin-card admin-discount-card">
          <span className="admin-card-kicker">MOTOR DE DESCONTO</span>
          <h2>Quanto dá para conceder?</h2>
          <div className="discount-options" aria-label="Percentual de desconto">
            {DISCOUNT_LEVELS.map((level) => {
              const item = assessDiscount(level)
              return (
                <button key={level} type="button" className={`discount-choice discount-${item.tone} ${discount === level ? 'is-active' : ''}`} onClick={() => setDiscount(level)}>
                  <strong>{level}%</strong><span>{item.label}</span>
                </button>
              )
            })}
          </div>
          <div className={`discount-assessment discount-${assessment.tone}`}>
            <strong>{assessment.percentage}% · {assessment.label}</strong>
            <p>{assessment.message}</p>
          </div>
          <div className="discount-legend">
            <span className="legend-green">Verde: saudável</span>
            <span className="legend-yellow">Amarelo: atenção</span>
            <span className="legend-red">Vermelho: alto</span>
            <span className="legend-purple">Roxo: impossível</span>
          </div>
        </article>

        <article className="admin-card">
          <span className="admin-card-kicker">PAGAMENTO</span>
          <h2>Boleto e parcelamento</h2>
          <label className="admin-field">Provedor
            <select value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}>
              <option value="none">Sem boleto</option>
              <option value="nubank">Nubank</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>
          </label>
          <div className="admin-inline-fields">
            <label className="admin-field">Parcelas<input type="number" min="1" max="24" step="1" value={installments} onChange={(event) => setInstallments(Math.max(1, Math.round(Number(event.target.value) || 1)))} /></label>
            <label className="admin-field">Taxa por boleto<input type="number" min="0" step="0.01" value={boletoFee} onChange={(event) => setBoletoFee(Number(event.target.value) || 0)} /></label>
          </div>
          <p className="admin-note">A taxa fica configurável no backend para não depender de valores fixos que podem mudar no provedor.</p>
          <div className="price-summary compact"><div><span>Custo estimado dos boletos</span><strong>{currency.format(paymentFees)}</strong></div></div>
        </article>

        <article className="admin-card admin-retention-card">
          <span className="admin-card-kicker">RETENÇÕES</span>
          <h2>Revisão fiscal antes da proposta</h2>
          <p className="admin-note warning">O sistema não presume obrigação tributária. Você informa as retenções aplicáveis e mantém a proposta em revisão fiscal antes de aprovar.</p>
          <div className="retention-grid">
            {(Object.keys(retentions) as (keyof RetentionInput)[]).map((key) => (
              <label className="admin-field" key={key}>{key.toUpperCase()} (%)
                <input type="number" min="0" max="100" step="0.01" value={retentions[key]} onChange={(event) => setRetention(key, event.target.value)} />
              </label>
            ))}
          </div>
          <div className="price-summary compact">
            <div><span>Total informado</span><strong>{retentionTotal.toFixed(2)}%</strong></div>
            <div><span>Líquido estimado após retenções</span><strong>{currency.format(estimatedNet)}</strong></div>
          </div>
        </article>

        <article className="admin-card admin-approval-card">
          <span className="admin-card-kicker">VALIDAÇÃO</span>
          <h2>Sua aprovação vem antes do cliente</h2>
          <ul>
            <li>Escopo interpretado revisado</li>
            <li>Preço e desconto revisados</li>
            <li>Forma de pagamento definida</li>
            <li>Retenções confirmadas quando aplicável</li>
            <li>Cliente ainda não recebeu nenhum valor</li>
          </ul>
          <button className="button button-primary" type="button" disabled={!canApprove}>Aprovar rascunho</button>
          {!canApprove && <small className="approval-blocked">Aprovação bloqueada pelas regras atuais.</small>}
        </article>
      </section>
    </main>
  )
}
