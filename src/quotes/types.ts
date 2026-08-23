export type DiscountLevel = 0 | 5 | 10 | 15 | 20

export type CommercialStatus = 'draft' | 'reviewed' | 'sent' | 'negotiating' | 'approved' | 'invoiced' | 'received' | 'lost' | 'cancelled'
export type PaymentMode = 'cash' | 'installments'

export type DiscountAssessment = {
  percentage: DiscountLevel
  tone: 'green' | 'yellow' | 'red' | 'purple'
  label: string
  message: string
  blocked: boolean
}

export type RetentionInput = {
  iss: number
  irrf: number
  pis: number
  cofins: number
  csll: number
  inss: number
}
