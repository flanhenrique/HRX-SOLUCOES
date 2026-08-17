import type { RetentionInput } from './types'

type ProviderRule = {
  provider: 'nubank' | 'mercadopago'
  boleto_fee_per_paid: number
}

export type QuotePreview = {
  baseAmount: number
  preDiscountAmount: number
  discountAmount: number
  paymentFeeTotal: number
  retentionNetTarget: number
  retentionTotal: number
  retentionAmount: number
  retentionGrossUpSuggestion: number
  finalAmount: number
  estimatedNet: number
  retentionBreakdown: Record<keyof RetentionInput, number>
}

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100

export function calculateQuotePreview(input: {
  baseAmount: number
  complexityMultiplier: number
  urgencyMultiplier: number
  discountPercent: number
  paymentProvider: 'none' | 'nubank' | 'mercadopago'
  installments: number
  providers: ProviderRule[]
  retentions: RetentionInput
  retentionPricingMode: 'informational' | 'preserve_net'
  fiscalReviewConfirmed: boolean
}): QuotePreview {
  const baseAmount = Math.max(0, Number(input.baseAmount) || 0)
  const complexity = Math.min(3, Math.max(0.5, Number(input.complexityMultiplier) || 1))
  const urgency = Math.min(3, Math.max(0.5, Number(input.urgencyMultiplier) || 1))
  const discountPercent = Math.min(100, Math.max(0, Number(input.discountPercent) || 0))
  const installments = Math.min(24, Math.max(1, Math.round(Number(input.installments) || 1)))

  const preDiscountAmount = roundMoney(baseAmount * complexity * urgency)
  const discountAmount = roundMoney(preDiscountAmount * (discountPercent / 100))
  const providerRule = input.paymentProvider === 'none'
    ? undefined
    : input.providers.find((item) => item.provider === input.paymentProvider)
  const paymentFeeTotal = roundMoney(Math.max(0, Number(providerRule?.boleto_fee_per_paid) || 0) * installments)
  const retentionNetTarget = roundMoney(preDiscountAmount - discountAmount + paymentFeeTotal)

  const normalizedRetentions = Object.fromEntries(
    (Object.entries(input.retentions) as [keyof RetentionInput, number][]).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]),
  ) as RetentionInput
  const retentionTotal = Object.values(normalizedRetentions).reduce((sum, value) => sum + value, 0)
  const safeRetentionTotal = Math.min(99.99, Math.max(0, retentionTotal))
  const retentionGrossUpSuggestion = safeRetentionTotal > 0
    ? roundMoney(retentionNetTarget / (1 - safeRetentionTotal / 100))
    : retentionNetTarget
  const finalAmount = input.retentionPricingMode === 'preserve_net' && input.fiscalReviewConfirmed && safeRetentionTotal > 0
    ? retentionGrossUpSuggestion
    : retentionNetTarget
  const retentionBreakdown = Object.fromEntries(
    (Object.entries(normalizedRetentions) as [keyof RetentionInput, number][]).map(([key, value]) => [key, roundMoney(finalAmount * (value / 100))]),
  ) as Record<keyof RetentionInput, number>
  const retentionAmount = roundMoney(Object.values(retentionBreakdown).reduce((sum, value) => sum + value, 0))
  const estimatedNet = roundMoney(finalAmount - retentionAmount)

  return {
    baseAmount: roundMoney(baseAmount),
    preDiscountAmount,
    discountAmount,
    paymentFeeTotal,
    retentionNetTarget,
    retentionTotal: safeRetentionTotal,
    retentionAmount,
    retentionGrossUpSuggestion,
    finalAmount,
    estimatedNet,
    retentionBreakdown,
  }
}
