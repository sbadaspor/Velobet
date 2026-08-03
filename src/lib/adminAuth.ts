import { createClient } from '@/lib/supabase/server'

// Só esta pessoa pode aceder ao /admin. Sem tabela de roles —
// de propósito, é a única administradora da app.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'ines.anjo@prozis.com').toLowerCase()

/** Usa em Server Components / Server Actions (tem acesso a cookies). */
export async function getIsAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.email?.toLowerCase() === ADMIN_EMAIL
}

/** Usa dentro de API routes — devolve o email se for admin, ou null. */
export async function requireAdmin(): Promise<{ email: string } | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email?.toLowerCase()
  if (!email || email !== ADMIN_EMAIL) return null
  return { email }
}
