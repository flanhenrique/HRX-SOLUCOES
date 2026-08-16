import type { QuoteRequestPayload, QuoteRequestResponse } from './types'

const endpoint = (import.meta.env.VITE_HRX_QUOTE_ENDPOINT as string | undefined)
  ?? 'https://tgcdkofplegmjvvkheyd.supabase.co/functions/v1/quote-intake'

const publishableKey = (import.meta.env.VITE_HRX_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  ?? 'sb_publishable_v9RLT-Cdlgsfu8PBJOfoIw_h_eLTDhC'

export function isQuoteEndpointConfigured() {
  return Boolean(endpoint && publishableKey)
}

export async function submitQuoteRequest(payload: QuoteRequestPayload): Promise<QuoteRequestResponse> {
  if (!endpoint || !publishableKey) throw new Error('QUOTE_ENDPOINT_NOT_CONFIGURED')

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publishableKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(`QUOTE_REQUEST_FAILED_${response.status}`)
  return response.json() as Promise<QuoteRequestResponse>
}
