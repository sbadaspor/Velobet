'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getExistingPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotifications'

type Estado = 'a_carregar' | 'nao_suportado' | 'bloqueado' | 'ligado' | 'desligado'

// Interruptor para ligar/desligar notificações, usado no Perfil.
// Complementa o cartão "Ativar notificações" (NotificationGate) — este dá
// controlo manual a quem já dispensou o cartão ou quer desligar mais tarde.
export default function NotificationToggle() {
  const supabase = createClient()
  const [estado, setEstado] = useState<Estado>('a_carregar')
  const [aProcessar, setAProcessar] = useState(false)

  useEffect(() => {
    let ativo = true

    async function verificar() {
      if (!isPushSupported()) {
        if (ativo) setEstado('nao_suportado')
        return
      }
      if (Notification.permission === 'denied') {
        if (ativo) setEstado('bloqueado')
        return
      }
      const subscription = await getExistingPushSubscription()
      if (!ativo) return
      setEstado(subscription ? 'ligado' : 'desligado')
    }

    verificar()
    return () => {
      ativo = false
    }
  }, [])

  async function alternar() {
    if (aProcessar || estado === 'a_carregar' || estado === 'nao_suportado' || estado === 'bloqueado') return
    setAProcessar(true)
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return

      if (estado === 'ligado') {
        await unsubscribeFromPush(supabase, data.user.id)
        setEstado('desligado')
        return
      }

      if (Notification.permission === 'default') {
        const permissao = await Notification.requestPermission()
        if (permissao !== 'granted') {
          setEstado(permissao === 'denied' ? 'bloqueado' : 'desligado')
          return
        }
      }
      await subscribeToPush(supabase, data.user.id)
      setEstado('ligado')
    } finally {
      setAProcessar(false)
    }
  }

  if (estado === 'nao_suportado') return null

  const ligado = estado === 'ligado'

  return (
    <div className="card flex items-center justify-between gap-4 mt-4">
      <div className="min-w-0">
        <div className="text-sm font-bold text-text">Notificações</div>
        <div className="text-xs text-text-dim mt-0.5">
          {estado === 'bloqueado'
            ? 'Bloqueadas — ativa nas definições do browser/telemóvel'
            : ligado
              ? 'Ativadas neste dispositivo'
              : 'Recebe avisos sobre novidades nas provas'}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label="Notificações"
        disabled={estado === 'a_carregar' || estado === 'bloqueado' || aProcessar}
        onClick={alternar}
        className="relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40"
        style={{ background: ligado ? 'var(--gold)' : 'var(--surface-3)', border: '1px solid var(--border)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: ligado ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}
