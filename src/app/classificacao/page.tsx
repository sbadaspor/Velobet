'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcularPontos, compararDesempate, type CategoriaProvaTipo } from '@/lib/pontuacao'

// Paleta fixa para as linhas do gráfico de evolução — mesma ordem
// sempre, registada no design system (Chart — Evolução).
const CHART_COLORS = ['#E0A916', '#211D15', '#146633', '#B5651D', '#1E40AF', '#6E7480']

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
const ListIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const TABS: { label: string; icon: () => React.ReactElement; href: string | null }[] = [
  { label: 'Hoje', icon: HomeIcon, href: '/hoje' },
  { label: 'Próximas', icon: CalendarIcon, href: null },
  { label: 'Classificação', icon: StarIcon, href: '/classificacao' },
  { label: 'Histórico', icon: ListIcon, href: null },
  { label: 'Eu', icon: UserIcon, href: '/perfil' },
]

function medalClass(pos: number) {
  if (pos === 1) return 'text-medal-1'
  if (pos === 2) return 'text-medal-2'
  if (pos === 3) return 'text-medal-3'
  return 'text-text'
}

type Prova = {
  id: string
  nome: string
  categoria: CategoriaProvaTipo | null
  status: string
}

type EtapaResultado = {
  id: string
  prova_id: string
  numero_etapa: number
  classificacao_geral_top20: string[]
  tempos_classificacao: Record<string, string> | null
  camisola_sprint: string | null
  camisola_montanha: string | null
  camisola_juventude: string | null
}

type ApostaRow = {
  id: string
  user_id: string
  apostas_top20: string[]
  camisola_sprint: string | null
  camisola_montanha: string | null
  camisola_juventude: string | null
  perfil: { username: string; full_name: string | null; avatar_url: string | null } | null
}

type PlayerStanding = {
  userId: string
  name: string
  avatarUrl: string | null
  points: number
  top10: number
  top20: number
}

type EvolutionSeries = {
  userId: string
  name: string
  color: string
  series: number[]
}

type CompData = {
  prova: Prova
  etapas: EtapaResultado[]
  hasStandings: boolean
  generalStandings: PlayerStanding[]
  evolution: EvolutionSeries[]
  stageHighlight: { stage: number; text: string } | null
}

function buildLinePath(series: number[], maxPoints: number, width: number, height: number, padding: number) {
  const n = series.length
  if (n === 0) return ''
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  return series
    .map((pts, i) => {
      const x = padding + (n === 1 ? 0 : (i / (n - 1)) * chartWidth)
      const y = padding + chartHeight - (maxPoints === 0 ? 0 : (pts / maxPoints) * chartHeight)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

const CHART_W = 400
const CHART_H = 180
const CHART_PAD = 28
const GRID_LINES = 4

export default function ClassificacaoPage() {
  const [loading, setLoading] = useState(true)
  const [comps, setComps] = useState<CompData[]>([])
  const [stageIdx, setStageIdx] = useState<Record<string, number>>({})

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()

      // status: 'aberta' = aberta para apostar (Próximas), 'fechada' = apostas
      // trancadas e prova a decorrer (aqui), 'finalizada' = prova terminada (Histórico).
      const { data: provasData } = await supabase
        .from('provas')
        .select('id, nome, categoria, status')
        .eq('status', 'fechada')

      const provas = (provasData ?? []) as Prova[]

      if (provas.length === 0) {
        setComps([])
        setLoading(false)
        return
      }

      const results: CompData[] = []

      for (const prova of provas) {
        const [{ data: etapasData }, { data: apostasData }] = await Promise.all([
          supabase
            .from('etapas_resultados')
            .select('*')
            .eq('prova_id', prova.id)
            .order('numero_etapa', { ascending: true }),
          supabase
            .from('apostas')
            .select('id, user_id, apostas_top20, camisola_sprint, camisola_montanha, camisola_juventude, perfil:perfis(username, full_name, avatar_url)')
            .eq('prova_id', prova.id),
        ])

        const etapas = (etapasData ?? []) as EtapaResultado[]
        const apostas = (apostasData ?? []) as unknown as ApostaRow[]

        if (etapas.length === 0 || apostas.length === 0) {
          results.push({
            prova,
            etapas,
            hasStandings: false,
            generalStandings: [],
            evolution: [],
            stageHighlight: null,
          })
          continue
        }

        const categoria = prova.categoria
        const latest = etapas[etapas.length - 1]

        const computados = apostas.map(aposta => {
          const camisolasApostadas = {
            sprint: aposta.camisola_sprint ?? '',
            montanha: aposta.camisola_montanha ?? '',
            juventude: aposta.camisola_juventude ?? '',
          }
          const camisolasReais = {
            sprint: latest.camisola_sprint ?? '',
            montanha: latest.camisola_montanha ?? '',
            juventude: latest.camisola_juventude ?? '',
          }
          const calc = calcularPontos(aposta.apostas_top20, latest.classificacao_geral_top20, camisolasApostadas, camisolasReais, categoria)
          return {
            userId: aposta.user_id,
            name: aposta.perfil?.full_name || aposta.perfil?.username || 'Jogador',
            avatarUrl: aposta.perfil?.avatar_url ?? null,
            calc,
            top10: calc.breakdown.filter(b => b.tipo === 'top10_exato').length,
            top20: calc.breakdown.filter(b => b.tipo === 'top20_exato').length,
          }
        })

        computados.sort((a, b) => compararDesempate(a.calc, b.calc))

        const generalStandings: PlayerStanding[] = computados.map(c => ({
          userId: c.userId,
          name: c.name,
          avatarUrl: c.avatarUrl,
          points: c.calc.pontos_total,
          top10: c.top10,
          top20: c.top20,
        }))

        const evolution: EvolutionSeries[] = computados.map((c, idx) => {
          const aposta = apostas.find(a => a.user_id === c.userId)!
          const series = etapas.map(etapa => {
            const camisolasApostadas = {
              sprint: aposta.camisola_sprint ?? '',
              montanha: aposta.camisola_montanha ?? '',
              juventude: aposta.camisola_juventude ?? '',
            }
            const camisolasReais = {
              sprint: etapa.camisola_sprint ?? '',
              montanha: etapa.camisola_montanha ?? '',
              juventude: etapa.camisola_juventude ?? '',
            }
            return calcularPontos(aposta.apostas_top20, etapa.classificacao_geral_top20, camisolasApostadas, camisolasReais, categoria).pontos_total
          })
          return { userId: c.userId, name: c.name, color: CHART_COLORS[idx % CHART_COLORS.length], series }
        })

        // Destaque: última mudança de líder ao longo das etapas
        let stageHighlight: CompData['stageHighlight'] = null
        if (evolution.length > 0 && etapas.length > 1) {
          let leaderIdx = -1
          for (let i = 0; i < etapas.length; i++) {
            let bestIdx = 0
            let bestPts = -Infinity
            evolution.forEach((e, idx) => {
              if (e.series[i] > bestPts) {
                bestPts = e.series[i]
                bestIdx = idx
              }
            })
            if (leaderIdx !== -1 && bestIdx !== leaderIdx) {
              stageHighlight = {
                stage: etapas[i].numero_etapa,
                text: `${evolution[bestIdx].name} passou a liderar com ${bestPts} pts`,
              }
            }
            leaderIdx = bestIdx
          }
        }

        results.push({ prova, etapas, hasStandings: true, generalStandings, evolution, stageHighlight })
      }

      setComps(results)
      setStageIdx(
        Object.fromEntries(
          results.filter(c => c.hasStandings).map(c => [c.prova.id, c.etapas.length - 1])
        )
      )
      setLoading(false)
    })()
  }, [])

  if (loading) return null

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-surface border-b border-border">
        <div className="flex-1 flex items-center">
          <button className="text-xl text-text" aria-label="Menu">☰</button>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 text-sm font-medium">
          <span className="w-3 h-3 rounded-full bg-gold" />
          <span>Tour · 2026</span>
        </div>
        <div className="flex-1 flex items-center justify-end">
          <div className="w-10 h-10 rounded-full bg-surface-3 border-2 border-border" />
        </div>
      </header>

      <div className="max-w-[560px] mx-auto px-5 py-5">
        {comps.length === 0 ? (
          <div className="table-wrapper text-center py-10 px-5">
            <div className="text-text-sub text-sm">Não há provas a decorrer neste momento</div>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {comps.map(comp => {
              const idx = stageIdx[comp.prova.id] ?? comp.etapas.length - 1
              const etapaAtual = comp.etapas[idx]
              const maxPoints = Math.max(1, ...comp.evolution.flatMap(e => e.series))

              return (
                <div key={comp.prova.id}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="eyebrow">{comp.prova.nome}</div>
                      <div className="display-lg">Classificação</div>
                    </div>
                    <span className="badge-status badge-a-decorrer">
                      <span className="dot" />A Decorrer
                    </span>
                  </div>

                  {!comp.hasStandings ? (
                    <div className="table-wrapper text-center py-10 px-5">
                      <div className="text-text-sub text-sm">Ainda sem resultados</div>
                    </div>
                  ) : (
                    <>
                      {/* Navegação de etapa */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <button
                          className="btn-secondary text-xs px-3 py-2"
                          disabled={idx <= 0}
                          onClick={() => setStageIdx(s => ({ ...s, [comp.prova.id]: idx - 1 }))}
                        >
                          ← Anterior
                        </button>
                        <div className="mono text-sm font-semibold">Etapa {etapaAtual.numero_etapa}</div>
                        <button
                          className="btn-secondary text-xs px-3 py-2"
                          disabled={idx >= comp.etapas.length - 1}
                          onClick={() => setStageIdx(s => ({ ...s, [comp.prova.id]: idx + 1 }))}
                        >
                          Próxima →
                        </button>
                      </div>

                      {/* Classificação geral dos apostadores */}
                      <div className="display-lg mb-3">Classificação Geral</div>
                      <div className="bg-surface border border-border rounded-lg overflow-hidden mb-8">
                        {comp.generalStandings.map((player, i) => (
                          <div
                            key={player.userId}
                            className={`flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-b-0 ${i % 2 === 1 ? 'bg-surface-2' : ''}`}
                          >
                            <div className={`w-8 text-center mono font-extrabold text-base ${medalClass(i + 1)}`}>{i + 1}</div>
                            <div className="w-9 h-9 rounded-full bg-surface-3 border border-border overflow-hidden flex-shrink-0">
                              {player.avatarUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold flex items-center gap-1.5">
                                <span className="truncate">{player.name}</span>
                                {i === 0 && (
                                  <span
                                    className="mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm"
                                    style={{ background: 'var(--gold-soft)', color: 'var(--gold-ink)' }}
                                  >
                                    Líder
                                  </span>
                                )}
                              </div>
                              <div className="mono text-xs text-text-dim mt-0.5">{player.top10} top 10 · {player.top20} top 20</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="mono font-bold text-base">{player.points}</div>
                              <div className="mono text-[11px] text-text-dim">pts</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Evolução por etapa */}
                      <div className="card mb-8">
                        <div className="display-lg mb-3">Evolução por etapa</div>

                        {comp.stageHighlight && (
                          <div
                            className="text-sm mb-3 px-4 py-3 rounded-md"
                            style={{ background: 'var(--surface-3)', borderLeft: '3px solid var(--gold)' }}
                          >
                            <strong>Etapa {comp.stageHighlight.stage}:</strong> {comp.stageHighlight.text}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-4 mb-3">
                          {comp.evolution.map(e => (
                            <div key={e.userId} className="flex items-center gap-1.5 text-xs text-text-dim">
                              <span className="inline-block w-3 h-0.5 rounded-sm" style={{ background: e.color }} />
                              {e.name}
                            </div>
                          ))}
                        </div>

                        <div className="bg-surface-2 border border-border rounded-lg p-4">
                          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="w-full" style={{ height: 180 }}>
                            {Array.from({ length: GRID_LINES - 1 }).map((_, i) => {
                              const y = CHART_PAD + ((i + 1) / GRID_LINES) * (CHART_H - CHART_PAD * 2)
                              return <line key={i} x1={CHART_PAD} y1={y} x2={CHART_W - CHART_PAD} y2={y} stroke="rgba(107,100,85,0.08)" strokeWidth={0.5} />
                            })}
                            {Array.from({ length: GRID_LINES + 1 }).map((_, i) => {
                              const y = CHART_PAD + (i / GRID_LINES) * (CHART_H - CHART_PAD * 2)
                              const val = Math.round(((GRID_LINES - i) / GRID_LINES) * maxPoints)
                              return (
                                <text key={i} x={CHART_PAD - 8} y={y + 3} fontFamily="JetBrains Mono, monospace" fontSize={9} fontWeight={500} textAnchor="end" fill="#6B6455">
                                  {val}
                                </text>
                              )
                            })}
                            {comp.evolution.map(e => (
                              <path
                                key={e.userId}
                                d={buildLinePath(e.series, maxPoints, CHART_W, CHART_H, CHART_PAD)}
                                stroke={e.color}
                                strokeWidth={1.5}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            ))}
                            <line x1={CHART_PAD} y1={CHART_PAD} x2={CHART_PAD} y2={CHART_H - CHART_PAD} stroke="#DED7C6" strokeWidth={1} />
                            <line x1={CHART_PAD} y1={CHART_H - CHART_PAD} x2={CHART_W - CHART_PAD} y2={CHART_H - CHART_PAD} stroke="#DED7C6" strokeWidth={1} />
                          </svg>
                          <div className="flex justify-between mt-2 mono text-[10px] text-text-dim tracking-wide">
                            {comp.etapas.map(e => (
                              <span key={e.id}>E{e.numero_etapa}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Top 20 da etapa selecionada */}
                      <div className="text-sm font-semibold text-text-dim mb-3">
                        Classificação Top 20 — Geral da etapa {etapaAtual.numero_etapa}
                      </div>
                      <div className="table-wrapper" style={{ maxHeight: 340, overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Pos.</th>
                              <th>Ciclista</th>
                              <th>Tempo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {etapaAtual.classificacao_geral_top20.map((ciclista, i) => (
                              <tr key={ciclista + i}>
                                <td className={`mono font-extrabold ${medalClass(i + 1)}`}>{i + 1}</td>
                                <td className="font-semibold">{ciclista}</td>
                                <td className="mono font-semibold">{etapaAtual.tempos_classificacao?.[ciclista] ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
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
          const active = tab.label === 'Classificação'
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
