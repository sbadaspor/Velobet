'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isPushSupported, subscribeToPush } from '@/lib/pushNotifications'

// Ecrãs principais onde o cartão pode aparecer (só depois do login).
const ECRAS_PRINCIPAIS = ['/hoje', '/proximas', '/classificacao', '/historico', '/perfil']

export default function NotificationGate() {
  const pathname = usePathname()
  const supabase = createClient()

  const [podeMostrar, setPodeMostrar] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [entrar, setEntrar] = useState(false) // controla a animação de entrada

  // "Fechei isto agora" — só dura enquanto a app estiver aberta (não é
  // guardado em disco). Ao sair e voltar a entrar na app (nova sessão),
  // isto reinicia e o cartão pode voltar a aparecer, como pedido.
  const [dispensadoNestaSessao, setDispensadoNestaSessao] = useState(false)

  // Regista o service worker uma vez, independentemente de mostrar o cartão —
  // é preciso já estar registado para o pushManager.subscribe() funcionar.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // silencioso — se falhar, o cartão simplesmente não vai conseguir subscrever
    })
  }, [])

  useEffect(() => {
    let ativo = true

    async function verificar() {
      if (typeof window === 'undefined') return
      if (!ECRAS_PRINCIPAIS.some((rota) => pathname?.startsWith(rota))) return
      if (!isPushSupported()) return
      // Se já ativou ou já bloqueou antes, o browser guarda isso para sempre
      // (não é algo que nós controlemos) — só mostramos quando ainda não decidiu.
      if (Notification.permission !== 'default') return
      if (dispensadoNestaSessao) return

      const { data } = await supabase.auth.getUser()
      if (!ativo) return
      if (!data.user) return

      setPodeMostrar(true)
    }

    verificar()
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, dispensadoNestaSessao])

  useEffect(() => {
    if (!podeMostrar) return
    setIsOpen(true)
    const t = setTimeout(() => setEntrar(true), 20)
    return () => clearTimeout(t)
  }, [podeMostrar])

  function fechar(dispensarSessao: boolean) {
    setEntrar(false)
    if (dispensarSessao) {
      setDispensadoNestaSessao(true)
    }
    setTimeout(() => {
      setIsOpen(false)
      setPodeMostrar(false)
      setIsConfirmed(false)
    }, 300)
  }

  async function ativar() {
    setIsConfirmed(true)

    setTimeout(async () => {
      try {
        const permissao = await Notification.requestPermission()

        if (permissao !== 'granted') {
          fechar(true)
          return
        }

        const { data } = await supabase.auth.getUser()
        if (data.user) {
          await subscribeToPush(supabase, data.user.id)
        }

        // Não precisa de "dispensar sessão" — a permissão já passou a
        // "granted", e é isso que impede o cartão de voltar a aparecer,
        // agora e em qualquer sessão futura.
        setTimeout(() => fechar(false), 2000)
      } catch {
        fechar(true)
      }
    }, 600)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center px-4 pb-6"
      style={{
        background: 'rgba(21, 19, 14, 0.4)',
        opacity: entrar ? 1 : 0,
        transition: 'opacity 0.2s ease-out',
      }}
      onClick={() => fechar(true)}
    >
      <div
        className="card w-full relative"
        style={{
          maxWidth: 430,
          boxShadow: '0 12px 32px rgba(0,0,0,.18)',
          transform: entrar ? 'translateY(0)' : 'translateY(24px)',
          opacity: entrar ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => fechar(true)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          ✕
        </button>

        {!isConfirmed ? (
          <>
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-2xl"
              style={{ background: 'var(--gold-soft)', borderRadius: 'var(--radius-sm)' }}
            >
              🔔
            </div>
            <h3 className="text-[16px] font-bold text-[var(--text)] mb-2">Ativa as notificações</h3>
            <p className="text-[14px] font-medium text-[var(--text-dim)] leading-relaxed mb-6">
              Sabe em primeira mão quando há novidades nas provas que acompanhas.
            </p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={ativar} className="btn-primary w-full uppercase tracking-wide">
                Ativar
              </button>
              <button
                type="button"
                onClick={() => fechar(true)}
                className="btn-secondary w-full uppercase tracking-wide justify-center"
                style={{ background: 'var(--surface-3)' }}
              >
                Agora não
              </button>
            </div>
          </>
        ) : (
          <div className="py-2 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"
              style={{
                background: 'var(--gold-soft)',
                transform: entrar ? 'scale(1)' : 'scale(0.8)',
                transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              ✓
            </div>
            <h3 className="text-[16px] font-bold text-[var(--text)] mb-1">Notificações ativadas</h3>
            <p className="text-[14px] text-[var(--text-dim)]">Vais receber atualizações em tempo real.</p>
          </div>
        )}
      </div>
    </div>
  )
}
