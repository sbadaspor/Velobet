import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com service_role — bypassa o RLS.
 * Usar APENAS em código server-side para queries de leitura pública
 * (leaderboards, H2H). NUNCA expor no browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
