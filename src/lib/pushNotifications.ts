// Helpers partilhados entre o cartão "Ativar notificações" (NotificationGate)
// e o interruptor de notificações no Perfil — para não duplicar a lógica de
// subscrever/cancelar push notifications nos dois sítios.

import type { SupabaseClient } from '@supabase/supabase-js'

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Subscrição já existente neste browser (independente do que está guardado
// na base de dados) — é a fonte da verdade sobre se este dispositivo está
// mesmo a receber pushes agora.
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

export async function subscribeToPush(
  supabase: SupabaseClient,
  userId: string
): Promise<PushSubscription> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY em falta')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const json = subscription.toJSON()
  if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
    await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        subscription_endpoint: json.endpoint,
        subscription_key_p256dh: json.keys.p256dh,
        subscription_key_auth: json.keys.auth,
      },
      { onConflict: 'user_id,subscription_endpoint' }
    )
  }

  return subscription
}

export async function unsubscribeFromPush(supabase: SupabaseClient, userId: string): Promise<void> {
  const subscription = await getExistingPushSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('subscription_endpoint', endpoint)
}
