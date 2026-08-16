export type ContactReason = 'orcamento' | 'projeto' | 'automacao' | 'consultoria' | 'outro'

export type ServiceInterest = 'gestao' | 'tecnologia' | 'documentacao' | 'operacoes' | 'nao_sei'

export type PreferredContact = 'whatsapp' | 'email'

export type QuoteRequestPayload = {
  name: string
  email: string
  phone: string
  company?: string
  reason: ContactReason
  interests: ServiceInterest[]
  request: string
  desiredDeadline?: string
  preferredContact: PreferredContact
  privacyConsent: true
  marketingConsent?: boolean
  source: 'website'
}

export type QuoteRequestResponse = {
  requestId: string
  protocol: string
  status: 'received' | 'interpreting' | 'awaiting_review'
}

export type DiscountLevel = 0 | 5 | 10 | 15 | 20

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
