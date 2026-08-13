'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcularPontos, compararDesempate, getConfigCategoria, type CategoriaProvaTipo } from '@/lib/pontuacao'
import JerseyBadge from '@/components/JerseyBadge'

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
const TABS: { label: string; icon: () => React.ReactElement; href: string | null }[] = [
  { label: 'Hoje', icon: HomeIcon, href: '/hoje' },
  { label: 'Próximas', icon: CalendarIcon, href: '/proximas' },
  { label: 'Classificação', icon: StarIcon, href: '/classificacao' },
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

type LinhaClassificacao = {
  posicao: number
  nome: string
  equipa?: string
  tempo: string
}

type EtapaResultado = {
  id: string
  prova_id: string
  numero_etapa: number
  classificacao_geral_top20: string[]
  classificacao_geral_completa: LinhaClassificacao[] | null
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

type CompData = {
  prova: Prova
  etapas: EtapaResultado[]
  hasStandings: boolean
  generalStandings: PlayerStanding[]
}

export default function ClassificacaoPage() {
  const [loading, setLoading] = useState(true)
  const [comps, setComps] = useState<CompData[]>([])
  const [stageIdx, setStageIdx] = useState<Record<string, number>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return
      const { data: perfil } = await supabase.from('perfis').select('avatar_url').eq('id', uid).single()
      setAvatarUrl(perfil?.avatar_url ?? null)
    })()
  }, [])

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

        results.push({ prova, etapas, hasStandings: true, generalStandings })
      }

      setComps(results)
      setStageIdx(
        Object.fromEntries(
          results
            .filter(c => c.hasStandings)
            .map(c => {
              // Por defeito mostra sempre a última etapa realizada (maior
              // numero_etapa com resultados já inseridos), não apenas a
              // última posição do array.
              let lastIdx = 0
              let maxNumero = -Infinity
              c.etapas.forEach((etapa, i) => {
                if (etapa.numero_etapa > maxNumero) {
                  maxNumero = etapa.numero_etapa
                  lastIdx = i
                }
              })
              return [c.prova.id, lastIdx]
            })
        )
      )
      setLoading(false)
    })()
  }, [])

  if (loading) return null

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-bg">
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

      <div className="flex-1 w-full max-w-[560px] mx-auto px-5 py-5">
        {comps.length === 0 ? (
          <div className="table-wrapper text-center py-10 px-5">
            <div className="text-text-sub text-sm">Não há provas a decorrer neste momento</div>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {comps.map(comp => {
              const idx = stageIdx[comp.prova.id] ?? comp.etapas.length - 1
              const etapaAtual = comp.etapas[idx]
              const ehFinal = comp.prova.status === 'finalizada'

              return (
                <div key={comp.prova.id}>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="eyebrow mb-1">{comp.prova.nome}</div>
                      <div className="display-lg">Classificação</div>
                      <span
                        className="mono text-[9px] font-bold uppercase inline-block mt-1 px-1.5 py-0.5 rounded-sm"
                        style={{
                          background: ehFinal ? 'var(--surface-3)' : 'var(--gold-soft)',
                          color: ehFinal ? 'var(--text-dim)' : 'var(--gold-ink)',
                        }}
                      >
                        {ehFinal ? 'Final' : 'Atual'}
                      </span>
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

                      {/* Classificação geral (completa) da etapa selecionada */}
                      <div className="text-sm font-semibold text-text-dim mb-3">
                        Classificação Geral da etapa {etapaAtual.numero_etapa}
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
                            {(
                              etapaAtual.classificacao_geral_completa && etapaAtual.classificacao_geral_completa.length > 0
                                ? [...etapaAtual.classificacao_geral_completa].sort((a, b) => a.posicao - b.posicao)
                                : etapaAtual.classificacao_geral_top20.map((nome, i) => ({
                                    posicao: i + 1,
                                    nome,
                                    tempo: etapaAtual.tempos_classificacao?.[nome] ?? '',
                                  }))
                            ).map(linha => (
                              <tr key={linha.nome + linha.posicao}>
                                <td className={`mono font-extrabold ${medalClass(linha.posicao)}`}>{linha.posicao}</td>
                                <td className="font-semibold">{linha.nome}</td>
                                <td className="mono font-semibold">{linha.tempo || etapaAtual.tempos_classificacao?.[linha.nome] || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Camisolas de líder (Sprint, Montanha, Juventude) */}
                      {getConfigCategoria(comp.prova.categoria).temCamisolas && (
                        <>
                          <div className="text-sm font-semibold text-text-dim mb-3 mt-8">Camisolas de Líder</div>
                          <div className="grid grid-cols-3 gap-3">
                            <JerseyBadge tipo="sprint" rider={etapaAtual.camisola_sprint} provaNome={comp.prova.nome} />
                            <JerseyBadge tipo="montanha" rider={etapaAtual.camisola_montanha} provaNome={comp.prova.nome} />
                            <JerseyBadge tipo="juventude" rider={etapaAtual.camisola_juventude} provaNome={comp.prova.nome} />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <footer className="sticky bottom-0 z-10 flex justify-around py-3 bg-bg">
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
