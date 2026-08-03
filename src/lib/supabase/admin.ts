import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com a chave "service role" — ignora RLS.
 * Só deve ser usado em código de servidor (API routes), NUNCA
 * importado por um componente 'use client'.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.')
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
