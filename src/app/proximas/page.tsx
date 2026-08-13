'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { RoutePoint } from '@/components/RouteMap'

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false })

// ── Ícones (mesmo estilo outline das outras páginas) ──
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <polygon points="12 2 15.09 10.26 23.77 10.26 17.39 15.04 20.49 23.31 12 18.54 3.51 23.31 6.61 15.04 0.23 10.26 8.91 10.26 12 2" />
  </svg>
)
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4 flex-shrink-0 transition-transform"
    style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const TABS: { label: string; icon: () => React.ReactElement; href: string | null }[] = [
  { label: 'Hoje', icon: HomeIcon, href: '/hoje' },
  { label: 'Próximas', icon: CalendarIcon, href: '/proximas' },
  { label: 'Classificação', icon: StarIcon, href: '/classificacao' },
]

type ProvaRow = {
  id: string
  nome: string
  data_inicio: string
  data_fim: string
  status: 'aberta' | 'fechada' | 'finalizada'
}

type EtapaPlaneada = {
  id: string
  prova_id: string
  numero_etapa: number
  perfil: string | null
  distancia_km: number | null
  elevacao_m: number | null
  local_partida: string | null
  local_chegada: string | null
  rota_pontos: RoutePoint[] | null
}

type Competicao = {
  id: string
  name: string
  startDate: string
  endDate: string
  daysLeft: number
  isOngoing: boolean
  urgent: boolean
  disabled: boolean
  stagesDetails: EtapaPlaneada[]
}

function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDateShort(iso: string) {
  const d = parseISODate(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function diasAte(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = parseISODate(iso)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function ProximasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [provas, setProvas] = useState<ProvaRow[]>([])
  const [etapasPorProva, setEtapasPorProva] = useState<Record<string, EtapaPlaneada[]>>({})
  const [provasComStartlist, setProvasComStartlist] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (uid) {
        const { data: perfil } = await supabase.from('perfis').select('avatar_url').eq('id', uid).single()
        setAvatarUrl(perfil?.avatar_url ?? null)
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()

      const { data: provasData } = await supabase
        .from('provas')
        .select('id, nome, data_inicio, data_fim, status')
        .neq('status', 'finalizada')
        .order('data_inicio', { ascending: true })

      const provasList = (provasData ?? []) as ProvaRow[]
      setProvas(provasList)

      if (provasList.length > 0) {
        const { data: etapasData } = await supabase
          .from('etapas_planeadas')
          .select('*')
          .in('prova_id', provasList.map(p => p.id))
          .order('numero_etapa', { ascending: true })

        const grouped: Record<string, EtapaPlaneada[]> = {}
        ;(etapasData ?? []).forEach((etapa: EtapaPlaneada) => {
          if (!grouped[etapa.prova_id]) grouped[etapa.prova_id] = []
          grouped[etapa.prova_id].push(etapa)
        })
        setEtapasPorProva(grouped)

        // "Apostar" só deve poder ser clicado se já houver startlist carregada.
        const { data: ciclistasData } = await supabase
          .from('ciclistas_prova')
          .select('prova_id')
          .in('prova_id', provasList.map(p => p.id))

        setProvasComStartlist(new Set((ciclistasData ?? []).map((c: { prova_id: string }) => c.prova_id)))
      }

      setLoading(false)
    })()
  }, [])

  const competicoes = useMemo<Competicao[]>(() => {
    const lista = provas.map(prova => {
      const daysLeft = diasAte(prova.data_inicio)
      const isOngoing = prova.status === 'fechada'
      return {
        id: prova.id,
        name: prova.nome,
        startDate: formatDateShort(prova.data_inicio),
        endDate: formatDateShort(prova.data_fim),
        daysLeft,
        isOngoing,
        urgent: daysLeft > 0 && daysLeft <= 7,
        disabled: prova.status !== 'aberta' || !provasComStartlist.has(prova.id),
        stagesDetails: etapasPorProva[prova.id] ?? [],
      }
    })

    return lista.sort((a, b) => (a.isOngoing ? -1 : a.daysLeft) - (b.isOngoing ? -1 : b.daysLeft))
  }, [provas, etapasPorProva, provasComStartlist])

  if (loading) return null

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-surface border-b border-border">
        <div className="flex-1 flex items-center relative">
          <button className="text-xl text-text" aria-label="Menu" onClick={() => setMenuOpen(o => !o)}>☰</button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full left-0 mt-2 z-30 bg-surface border border-border rounded-lg shadow-sm py-1.5 min-w-[200px]">
                <Link href="/historico" className="block px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-2" onClick={() => setMenuOpen(false)}>
                  Histórico
                </Link>
                <Link href="/regras" className="block px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-2" onClick={() => setMenuOpen(false)}>
                  Regras & Pontuação
                </Link>
              </div>
            </>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 text-sm font-medium">
          <span className="w-3 h-3 rounded-full bg-gold" />
          <span>Velo Bet</span>
        </div>
        <div className="flex-1 flex items-center justify-end">
          <Link href="/perfil" className="block w-10 h-10 rounded-full bg-surface-3 border-2 border-border overflow-hidden">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            )}
          </Link>
        </div>
      </header>

      <div className="max-w-[560px] mx-auto px-5 py-5 flex-1 w-full">
        <div className="eyebrow mb-2">Calendário</div>
        <div className="display-lg mb-5">Próximas provas</div>

        {competicoes.length === 0 ? (
          <div className="table-wrapper text-center py-10 px-5">
            <div className="text-text-sub text-sm">Sem próximas provas previstas</div>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            {competicoes.map((comp, i) => {
              const isExpanded = expandedId === comp.id
              const hasStages = comp.stagesDetails.length > 0

              return (
                <div key={comp.id}>
                  <div
                    className={`flex flex-col gap-2 px-5 py-3.5 border-b border-border ${i % 2 === 1 ? 'bg-surface-2' : ''} ${hasStages ? 'cursor-pointer' : ''}`}
                    onClick={() => hasStages && setExpandedId(isExpanded ? null : comp.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold min-w-0 truncate">{comp.name}</div>
                      {hasStages && <ChevronIcon expanded={isExpanded} />}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="mono text-xs text-text-dim flex-shrink-0" style={{ minWidth: 66 }}>
                        {comp.startDate} – {comp.endDate}
                      </div>

                      <div className="flex-1" />

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {comp.isOngoing ? (
                          <span className="badge-status badge-a-decorrer">
                            <span className="dot" />A decorrer
                          </span>
                        ) : (
                          <div className={`mono text-sm font-bold text-right ${comp.urgent ? 'text-gold-strong' : 'text-text'}`} style={{ minWidth: 60 }}>
                            Faltam {comp.daysLeft}
                          </div>
                        )}
                        <button
                          className="btn-primary text-xs px-3.5 py-2"
                          disabled={comp.disabled}
                          onClick={e => { e.stopPropagation(); router.push(`/apostar/${comp.id}`) }}
                        >
                          Apostar
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && hasStages && (
                    <div className="px-5 py-4 bg-surface-3 border-b border-border">
                      <div
                        className="flex items-center gap-2 mb-3 cursor-pointer"
                        onClick={() => setExpandedId(null)}
                      >
                        <ChevronIcon expanded={true} />
                        <div className="display-lg" style={{ fontSize: 14 }}>{comp.stagesDetails.length} Etapas</div>
                      </div>

                      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        {comp.stagesDetails.map(stage => {
                          const stageKey = `${comp.id}-${stage.numero_etapa}`
                          const stageExpanded = !!expandedStages[stageKey]

                          return (
                            <div key={stage.id} className="py-3 border-b border-border last:border-b-0">
                              <div
                                className="flex items-center justify-between gap-3 cursor-pointer"
                                onClick={() => setExpandedStages(s => ({ ...s, [stageKey]: !s[stageKey] }))}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="mono text-xs font-bold" style={{ minWidth: 24 }}>E{stage.numero_etapa}</div>
                                  <div className="text-sm font-medium truncate">
                                    {stage.local_partida && stage.local_chegada
                                      ? `${stage.local_partida} → ${stage.local_chegada}`
                                      : stage.perfil ?? '—'}
                                  </div>
                                </div>
                                <div className="mono text-xs text-text-dim flex-shrink-0">{stage.distancia_km ?? '—'} km</div>
                                <ChevronIcon expanded={stageExpanded} />
                              </div>

                              {stageExpanded && (
                                <div className="flex gap-6 mt-2">
                                  <div>
                                    <div className="eyebrow" style={{ fontSize: 9 }}>Distância</div>
                                    <div className="mono text-sm font-bold mt-0.5">{stage.distancia_km ?? '—'} km</div>
                                  </div>
                                  <div>
                                    <div className="eyebrow" style={{ fontSize: 9 }}>Acumulado</div>
                                    <div className="mono text-sm font-bold mt-0.5">{stage.elevacao_m ?? '—'} m</div>
                                  </div>
                                  {stage.perfil && (
                                    <div className="min-w-0">
                                      <div className="eyebrow" style={{ fontSize: 9 }}>Tipo</div>
                                      <div className="text-sm font-bold mt-0.5 truncate">{stage.perfil}</div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {stageExpanded && stage.rota_pontos && stage.rota_pontos.length >= 2 && (
                                <div className="mt-3">
                                  <RouteMap
                                    route={{
                                      distancia_km: stage.distancia_km,
                                      elevacao_m: stage.elevacao_m,
                                      perfil: stage.perfil,
                                      pontos: stage.rota_pontos,
                                    }}
                                    size="compact"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <footer className="sticky bottom-0 z-10 flex justify-around py-3 bg-surface border-t border-border">
        {TABS.map(tab => {
          const active = tab.label === 'Próximas'
          const content = (
            <div className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide bottom-nav-item ${active ? 'active' : ''}`}>
              <tab.icon />
              <div>{tab.label}</div>
            </div>
          )
          return tab.href ? (
            <Link key={tab.label} href={tab.href} className="flex-1 cursor-pointer">
              {content}
            </Link>
          ) : (
            <div key={tab.label} className="flex-1 cursor-not-allowed opacity-70">
              {content}
            </div>
          )
        })}
      </footer>
    </div>
  )
}
