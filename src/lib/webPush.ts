import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

let configurado = false

function garantirConfig() {
  if (configurado) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY em falta nas env vars.')
  }
  webpush.setVapidDetails('mailto:danielcostasilva.dcs@gmail.com', publicKey, privateKey)
  configurado = true
}

export type NotificacaoPayload = {
  title: string
  body: string
  url?: string
}

/**
 * Envia uma notificação push a todas as subscrições guardadas para os
 * `userIds` indicados. Nunca lança erro para fora — falhas de envio são
 * ignoradas por subscrição (não interrompem as outras), e subscrições
 * inválidas/expiradas (404/410) são apagadas automaticamente.
 */
export async function enviarNotificacaoPush(
  userIds: string[],
  payload: NotificacaoPayload,
  supabaseAdmin?: SupabaseClient
) {
  if (!userIds || userIds.length === 0) return

  try {
    garantirConfig()
  } catch (e) {
    console.error('[webPush] VAPID não configurado:', e)
    return
  }

  const supabase = supabaseAdmin ?? createAdminClient()

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, subscription_endpoint, subscription_key_p256dh, subscription_key_auth')
    .in('user_id', userIds)

  if (error || !subs || subs.length === 0) return

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.subscription_endpoint,
            keys: {
              p256dh: sub.subscription_key_p256dh,
              auth: sub.subscription_key_auth,
            },
          },
          JSON.stringify(payload)
        )
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number } | undefined)?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[webPush] falha a enviar para', sub.id, err)
        }
      }
    })
  )
}
