import type { RetentionInput } from './types'

type ProviderRule = { provider: 'nubank' | 'mercadopago'; boleto_fee_per_paid: number }

export type QuotePreview = {
  baseAmount: number
  preDiscountAmount: number
  discountAmount: number
  taxAmount: number
  paymentFeeTotal: number
  calculatedAmount: number
  customAdjustmentAmount: number
  customAdjustmentPercent: number
  retentionNetTarget: number
  retentionTotal: number
  retentionAmount: number
  retentionGrossUpSuggestion: number
  finalAmount: number
  estimatedNet: number
  retentionBreakdown: Record<keyof RetentionInput, number>
}

export type PlannedInstallment = { installmentNumber: number; amount: number; dueDate: string }

export const toCents = (value: number) => Math.max(0, Math.round((Number(value) || 0) * 100))
export const fromCents = (value: number) => Math.round(value) / 100
export const roundMoney = (value: number) => fromCents(toCents(value))

export function calculateQuotePreview(input: {
  baseAmount: number
  complexityMultiplier: number
  urgencyMultiplier: number
  discountPercent: number
  taxPercent?: number
  desiredFinalAmount?: number | null
  paymentProvider: 'none' | 'nubank' | 'mercadopago'
  installments: number
  providers: ProviderRule[]
  retentions: RetentionInput
  retentionPricingMode: 'informational' | 'preserve_net'
  fiscalReviewConfirmed: boolean
}): QuotePreview {
  const baseAmount = fromCents(toCents(input.baseAmount))
  const complexity = Math.min(3, Math.max(0.5, Number(input.complexityMultiplier) || 1))
  const urgency = Math.min(3, Math.max(0.5, Number(input.urgencyMultiplier) || 1))
  const discountPercent = Math.min(100, Math.max(0, Number(input.discountPercent) || 0))
  const taxPercent = Math.min(99.9999, Math.max(0, Number(input.taxPercent) || 0))
  const installments = Math.min(24, Math.max(1, Math.round(Number(input.installments) || 1)))
  const preDiscountCents = Math.round(toCents(baseAmount) * complexity * urgency)
  const discountCents = Math.round(preDiscountCents * discountPercent / 100)
  const taxableCents = Math.max(0, preDiscountCents - discountCents)
  const taxCents = Math.round(taxableCents * taxPercent / 100)
  const providerRule = input.paymentProvider === 'none' ? undefined : input.providers.find((item) => item.provider === input.paymentProvider)
  const paymentFeeCents = toCents(Math.max(0, Number(providerRule?.boleto_fee_per_paid) || 0)) * installments
  const commercialCents = taxableCents + taxCents + paymentFeeCents
  const normalizedRetentions = Object.fromEntries((Object.entries(input.retentions) as [keyof RetentionInput, number][]).map(([key, value]) => [key, Math.max(0, Number(value) || 0)])) as RetentionInput
  const retentionTotal = Math.min(99.99, Math.max(0, Object.values(normalizedRetentions).reduce((sum, value) => sum + value, 0)))
  const retentionGrossUpCents = retentionTotal > 0 ? Math.round(commercialCents / (1 - retentionTotal / 100)) : commercialCents
  const calculatedCents = input.retentionPricingMode === 'preserve_net' && input.fiscalReviewConfirmed && retentionTotal > 0 ? retentionGrossUpCents : commercialCents
  const requestedCents = input.desiredFinalAmount == null ? null : toCents(input.desiredFinalAmount)
  const finalCents = requestedCents != null && requestedCents > 0 && requestedCents <= calculatedCents ? requestedCents : calculatedCents
  const adjustmentCents = Math.max(0, calculatedCents - finalCents)
  const retentionBreakdown = Object.fromEntries((Object.entries(normalizedRetentions) as [keyof RetentionInput, number][]).map(([key, value]) => [key, fromCents(Math.round(finalCents * value / 100))])) as Record<keyof RetentionInput, number>
  const retentionAmountCents = Object.values(retentionBreakdown).reduce((sum, value) => sum + toCents(value), 0)
  return {
    baseAmount,
    preDiscountAmount: fromCents(preDiscountCents),
    discountAmount: fromCents(discountCents),
    taxAmount: fromCents(taxCents),
    paymentFeeTotal: fromCents(paymentFeeCents),
    calculatedAmount: fromCents(calculatedCents),
    customAdjustmentAmount: fromCents(adjustmentCents),
    customAdjustmentPercent: calculatedCents ? Math.round(adjustmentCents * 1_000_000 / calculatedCents) / 10_000 : 0,
    retentionNetTarget: fromCents(commercialCents),
    retentionTotal,
    retentionAmount: fromCents(retentionAmountCents),
    retentionGrossUpSuggestion: fromCents(retentionGrossUpCents),
    finalAmount: fromCents(finalCents),
    estimatedNet: fromCents(Math.max(0, finalCents - retentionAmountCents)),
    retentionBreakdown,
  }
}

export function buildInstallmentSchedule(input: { total: number; count: number; firstDueDate: string; intervalDays: number }): PlannedInstallment[] {
  const count = Math.min(24, Math.max(1, Math.round(Number(input.count) || 1)))
  const totalCents = toCents(input.total)
  const baseCents = Math.floor(totalCents / count)
  let remainder = totalCents - baseCents * count
  const first = new Date(`${input.firstDueDate}T12:00:00`)
  if (Number.isNaN(first.getTime())) return []
  const interval = Math.min(365, Math.max(1, Math.round(Number(input.intervalDays) || 30)))
  return Array.from({ length: count }, (_, index) => {
    const amountCents = baseCents + (remainder-- > 0 ? 1 : 0)
    const due = new Date(first)
    due.setDate(due.getDate() + interval * index)
    return { installmentNumber: index + 1, amount: fromCents(amountCents), dueDate: due.toISOString().slice(0, 10) }
  })
}
