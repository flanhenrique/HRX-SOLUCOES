import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tgcdkofplegmjvvkheyd.supabase.co'
const publishableKey = 'sb_publishable_v9RLT-Cdlgsfu8PBJOfoIw_h_eLTDhC'

export const hrxSupabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const quoteAdminEndpoint = `${supabaseUrl}/functions/v1/quote-admin`
export const hrxPublishableKey = publishableKey
