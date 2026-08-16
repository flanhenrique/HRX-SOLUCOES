import type { DiscountAssessment, DiscountLevel } from './types'

export const DISCOUNT_LEVELS: DiscountLevel[] = [0, 5, 10, 15, 20]

export function assessDiscount(percentage: DiscountLevel): DiscountAssessment {
  if (percentage <= 5) return { percentage, tone: 'green', label: percentage === 0 ? 'Sem desconto' : 'Faixa saudável', message: 'Desconto dentro da faixa comercial mais segura.', blocked: false }
  if (percentage === 10) return { percentage, tone: 'yellow', label: 'Atenção', message: 'Revisar margem, escopo e condições antes de aprovar.', blocked: false }
  if (percentage === 15) return { percentage, tone: 'red', label: 'Desconto alto', message: 'Aplicação excepcional. Considere reduzir escopo ou alterar condições.', blocked: false }
  return { percentage, tone: 'purple', label: 'Bloqueado', message: 'Este desconto não pode ser aprovado pelo fluxo normal.', blocked: true }
}
