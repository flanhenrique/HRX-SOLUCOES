import type { QuoteRequestPayload, QuoteRequestResponse } from './types'

const endpoint = import.meta.env.VITE_HRX_QUOTE_ENDPOINT as string | undefined

export function isQuoteEndpointConfigured() {
  return Boolean(endpoint)
}

export async function submitQuoteRequest(payload: QuoteRequestPayload): Promise<QuoteRequestResponse> {
  if (!endpoint) {
    throw new Error('QUOTE_ENDPOINT_NOT_CONFIGURED')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`QUOTE_REQUEST_FAILED_${response.status}`)
  }

  return response.json() as Promise<QuoteRequestResponse>
}
