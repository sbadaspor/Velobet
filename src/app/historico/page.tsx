'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcularPontos, compararDesempate, type CategoriaProvaTipo } from '@/lib/pontuacao'

// Paleta fixa para as linhas do gráfico "Corrida pelo topo" — mesma
// ordem que a usada na Classificação (Chart — Evolução).
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
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const TABS: { label: string; icon: () => React.ReactElement; href: string }[] = [
  { label: 'Hoje', icon: HomeIcon, href: '/hoje' },
  { label: 'Próximas', icon: CalendarIcon, href: '/proximas' },
  { label: 'Classificação', icon: StarIcon, href: '/classificacao' },
  { label: 'Eu', icon: UserIcon, href: '/perfil' },
]

function medalClass(pos: number) {
  if (pos === 1) return 'text-medal-1'
  if (pos === 2) return 'text-medal-2'
  if (pos === 3) return 'text-medal-3'
  return 'text-text'
}

type RaceKey = 'giro' | 'tour' | 'vuelta'

const RACE_INFO: Record<RaceKey, { flag: string; shortName: string; fullName: string }> = {
  giro: { flag: '🇮🇹', shortName: 'Giro', fullName: "Giro d'Italia" },
  tour: { flag: '🇫🇷', shortName: 'Tour', fullName: 'Tour de France' },
  vuelta: { flag: '🇪🇸', shortName: 'Vuelta', fullName: 'La Vuelta' },
}

function raceKeyFromName(nome: string): RaceKey | null {
  const n = nome.toLowerCase()
  if (n.includes('giro')) return 'giro'
  if (n.includes('tour')) return 'tour'
  if (n.includes('vuelta')) return 'vuelta'
  return null
}

type CamisolaComparacao = {
  tipo: 'Sprint' | 'Montanha' | 'Juventude'
  apostada: string | null
  real: string | null
}

function buildCamisolas(
  sprintA: string | null, sprintR: string | null,
  montA: string | null, montR: string | null,
  juvA: string | null, juvR: string | null
): CamisolaComparacao[] | null {
  if (!sprintA && !sprintR && !montA && !montR && !juvA && !juvR) return null
  return [
    { tipo: 'Sprint', apostada: sprintA, real: sprintR },
    { tipo: 'Montanha', apostada: montA, real: montR },
    { tipo: 'Juventude', apostada: juvA, real: juvR },
  ]
}

type StandingEntry = {
  username: string
  name: string
  points: number
  apostasTop: string[]
  resultadoTop: string[]
  camisolas: CamisolaComparacao[] | null
}

type Edition = {
  raceKey: RaceKey
  year: number
  standings: StandingEntry[]
}

type HistRow = {
  ano: number
  nome_prova: string
  username: string
  full_name: string
  pontos_total: number
  apostas_top: string[]
  resultado_real_top: string[]
  camisola_sprint_apostada: string | null
  camisola_sprint_real: string | null
  camisola_montanha_apostada: string | null
  camisola_montanha_real: string | null
  camisola_juventude_apostada: string | null
  camisola_juventude_real: string | null
}

type ProvaFinalizada = {
  id: string
  nome: string
  categoria: CategoriaProvaTipo | null
  status: string
}

type EtapaResultadoRow = {
  numero_etapa: number
  classificacao_geral_top20: string[]
  camisola_sprint: string | null
  camisola_montanha: string | null
  camisola_juventude: string | null
}

type ApostaLiveRow = {
  user_id: string
  apostas_top20: string[]
  camisola_sprint: string | null
  camisola_montanha: string | null
  camisola_juventude: string | null
  perfil: { username: string; full_name: string | null } | null
}

function buildLinePath(series: number[], maxValue: number, width: number, height: number, padding: number) {
  const n = series.length
  if (n === 0) return ''
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  return series
    .map((v, i) => {
      const x = padding + (n === 1 ? 0 : (i / (n - 1)) * chartWidth)
      const y = padding + chartHeight - (maxValue === 0 ? 0 : (v / maxValue) * chartHeight)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

const CHART_W = 400
const CHART_H = 160
const CHART_PAD = 16

export default function HistoricoPage() {
  const [loading, setLoading] = useState(true)
  const [editions, setEditions] = useState<Edition[]>([])
  const [selectedRace, setSelectedRace] = useState<RaceKey>('tour')
  const [selectedYear, setSelectedYear] = useState<number>(2025)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
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

      const [{ data: histData }, { data: provasData }] = await Promise.all([
        supabase.from('apostas_historicas').select('*'),
        supabase.from('provas').select('id, nome, categoria, status').eq('status', 'finalizada'),
      ])

      const editionsMap = new Map<string, Edition>()

      // 1) Histórico importado da base antiga (2022-2025)
      const histRows = (histData ?? []) as HistRow[]
      for (const row of histRows) {
        const raceKey = raceKeyFromName(row.nome_prova)
        if (!raceKey) continue
        const key = `${raceKey}-${row.ano}`
        if (!editionsMap.has(key)) editionsMap.set(key, { raceKey, year: row.ano, standings: [] })
        editionsMap.get(key)!.standings.push({
          username: row.username,
          name: row.full_name || row.username,
          points: row.pontos_total,
          apostasTop: row.apostas_top,
          resultadoTop: row.resultado_real_top,
          camisolas: buildCamisolas(
            row.camisola_sprint_apostada, row.camisola_sprint_real,
            row.camisola_montanha_apostada, row.camisola_montanha_real,
            row.camisola_juventude_apostada, row.camisola_juventude_real
          ),
        })
      }

      // 2) Provas já "finalizada" no sistema novo (ex. Giro d'Italia 2026) —
      // calculadas ao vivo com o mesmo motor de pontuação da Classificação.
      const provas = (provasData ?? []) as ProvaFinalizada[]
      for (const prova of provas) {
        const raceKey = raceKeyFromName(prova.nome)
        const yearMatch = prova.nome.match(/(\d{4})/)
        if (!raceKey || !yearMatch) continue
        const year = parseInt(yearMatch[1], 10)

        const [{ data: etapasData }, { data: apostasData }] = await Promise.all([
          supabase.from('etapas_resultados').select('*').eq('prova_id', prova.id).order('numero_etapa', { ascending: true }),
          supabase
            .from('apostas')
            .select('user_id, apostas_top20, camisola_sprint, camisola_montanha, camisola_juventude, perfil:perfis(username, full_name)')
            .eq('prova_id', prova.id),
        ])

        const etapas = (etapasData ?? []) as EtapaResultadoRow[]
        const apostas = (apostasData ?? []) as unknown as ApostaLiveRow[]
        if (etapas.length === 0 || apostas.length === 0) continue

        const latest = etapas[etapas.length - 1]

        const computados = apostas.map(aposta => {
          const camisolasApostadas = { sprint: aposta.camisola_sprint ?? '', montanha: aposta.camisola_montanha ?? '', juventude: aposta.camisola_juventude ?? '' }
          const camisolasReais = { sprint: latest.camisola_sprint ?? '', montanha: latest.camisola_montanha ?? '', juventude: latest.camisola_juventude ?? '' }
          const calc = calcularPontos(aposta.apostas_top20, latest.classificacao_geral_top20, camisolasApostadas, camisolasReais, prova.categoria)
          return {
            username: aposta.perfil?.username ?? aposta.user_id,
            name: aposta.perfil?.full_name || aposta.perfil?.username || 'Jogador',
            calc,
            aposta,
          }
        })
        computados.sort((a, b) => compararDesempate(a.calc, b.calc))

        const key = `${raceKey}-${year}`
        editionsMap.set(key, {
          raceKey,
          year,
          standings: computados.map(c => ({
            username: c.username,
            name: c.name,
            points: c.calc.pontos_total,
            apostasTop: c.aposta.apostas_top20,
            resultadoTop: latest.classificacao_geral_top20,
            camisolas: buildCamisolas(
              c.aposta.camisola_sprint, latest.camisola_sprint,
              c.aposta.camisola_montanha, latest.camisola_montanha,
              c.aposta.camisola_juventude, latest.camisola_juventude
            ),
          })),
        })
      }

      for (const ed of editionsMap.values()) {
        ed.standings.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      }

      const raceOrder: Record<RaceKey, number> = { giro: 0, tour: 1, vuelta: 2 }
      const editionsArr = Array.from(editionsMap.values()).sort((a, b) => a.year - b.year || raceOrder[a.raceKey] - raceOrder[b.raceKey])

      setEditions(editionsArr)
      if (editionsArr.length > 0) {
        const last = editionsArr[editionsArr.length - 1]
        setSelectedRace(last.raceKey)
        setSelectedYear(last.year)
      }
      setLoading(false)
    })()
  }, [])

  const currentEdition = useMemo(
    () => editions.find(e => e.raceKey === selectedRace && e.year === selectedYear) ?? null,
    [editions, selectedRace, selectedYear]
  )

  const availableYearsForRace = useMemo(
    () => editions.filter(e => e.raceKey === selectedRace).map(e => e.year).sort((a, b) => b - a),
    [editions, selectedRace]
  )

  const rivalidade = useMemo(() => {
    if (editions.length === 0) return null

    const tally = new Map<string, { name: string; totalWins: number; giroWins: number; tourWins: number; vueltaWins: number }>()
    editions.forEach(ed => {
      const winner = ed.standings[0]
      if (!winner) return
      if (!tally.has(winner.username)) tally.set(winner.username, { name: winner.name, totalWins: 0, giroWins: 0, tourWins: 0, vueltaWins: 0 })
      const t = tally.get(winner.username)!
      t.totalWins++
      if (ed.raceKey === 'giro') t.giroWins++
      if (ed.raceKey === 'tour') t.tourWins++
      if (ed.raceKey === 'vuelta') t.vueltaWins++
    })

    const ranking = Array.from(tally.entries())
      .map(([username, v]) => ({ username, ...v }))
      .sort((a, b) => b.totalWins - a.totalWins || a.name.localeCompare(b.name))
      .map((r, i) => ({ ...r, color: CHART_COLORS[i % CHART_COLORS.length], badgeText: i === 0 ? 'Líder' : `${i + 1}.º lugar` }))

    const series = ranking.map(r => {
      let cum = 0
      const points = editions.map(ed => {
        if (ed.standings[0]?.username === r.username) cum++
        return cum
      })
      return { username: r.username, name: r.name, color: r.color, points }
    })

    const maxWins = Math.max(1, ...series.flatMap(s => s.points))
    const giroCount = editions.filter(e => e.raceKey === 'giro').length
    const tourCount = editions.filter(e => e.raceKey === 'tour').length
    const vueltaCount = editions.filter(e => e.raceKey === 'vuelta').length
    const firstYear = Math.min(...editions.map(e => e.year))

    return { ranking, series, maxWins, giroCount, tourCount, vueltaCount, firstYear }
  }, [editions])

  // Extraídos para evitar acessos repetidos a `rivalidade?.` dentro de
  // callbacks (o TypeScript não preserva a narrow de optional chaining
  // em funções aninhadas).
  const ranking = rivalidade?.ranking ?? []
  const series = rivalidade?.series ?? []
  const maxWins = rivalidade?.maxWins ?? 1

  if (loading) return null

  return (
    <div className="min-h-screen bg-bg">
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
          <span>Tour · 2026</span>
        </div>
        <div className="flex-1 flex items-center justify-end">
          <Link href="/perfil" className="block w-10 h-10 rounded-full bg-surface-3 border-2 border-border overflow-hidden cursor-pointer">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            )}
          </Link>
        </div>
      </header>

      <div className="max-w-[560px] mx-auto px-5 py-5">
        {editions.length === 0 ? (
          <div className="table-wrapper text-center py-14 px-5">
            <div className="text-3xl mb-3 opacity-30">📋</div>
            <div className="text-text-sub text-sm">Ainda não há histórico disponível</div>
          </div>
        ) : (
          <>
            {/* ── Rivalidade ── */}
            <div className="mb-6">
              <div className="eyebrow flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-gold" />
                Rivalidade
              </div>
              <div className="display-2xl mb-1">Histórico</div>
              <div className="text-sm text-text-dim mb-3">
                Todas as Grandes Voltas disputadas — desde {rivalidade?.firstYear}.
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center py-3 rounded-md bg-surface-3">
                  <div className="mono text-lg font-bold">{rivalidade?.giroCount ?? 0}</div>
                  <div className="text-lg">🇮🇹</div>
                  <div className="mono text-[10px] uppercase tracking-wide text-text-dim">Giros</div>
                </div>
                <div className="text-center py-3 rounded-md bg-surface-3">
                  <div className="mono text-lg font-bold">{rivalidade?.tourCount ?? 0}</div>
                  <div className="text-lg">🇫🇷</div>
                  <div className="mono text-[10px] uppercase tracking-wide text-text-dim">Tours</div>
                </div>
                <div className="text-center py-3 rounded-md bg-surface-3">
                  <div className="mono text-lg font-bold">{rivalidade?.vueltaCount ?? 0}</div>
                  <div className="text-lg">🇪🇸</div>
                  <div className="mono text-[10px] uppercase tracking-wide text-text-dim">Vueltas</div>
                </div>
              </div>
            </div>

            {/* Confronto Geral */}
            <div className="card mb-6">
              <div className="eyebrow mb-4">Confronto Geral</div>
              <div className="flex gap-0 overflow-x-auto">
                {ranking.map((rider, i) => (
                  <div
                    key={rider.username}
                    className={`flex-shrink-0 w-[110px] flex flex-col items-center text-center pr-3 relative ${i !== ranking.length - 1 ? 'border-r border-border' : ''}`}
                  >
                    <div className="h-1 w-full mb-3 rounded-sm" style={{ background: rider.color }} />
                    <div className="w-12 h-12 rounded-full bg-surface-3 border-2 border-border mb-2" />
                    <div className="text-sm font-semibold mb-1.5 px-1">{rider.name}</div>
                    <div
                      className="mono text-[9px] font-semibold px-2 py-0.5 rounded-full mb-2"
                      style={{ background: 'var(--gold-soft)', color: 'var(--gold-ink)' }}
                    >
                      {rider.badgeText}
                    </div>
                    <div className="mono text-xl font-extrabold mb-2">{rider.totalWins}</div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <div className="flex items-center justify-center gap-1 text-xs text-text-dim">
                        <span>🇮🇹</span><span>{rider.giroWins}</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs text-text-dim">
                        <span>🇫🇷</span><span>{rider.tourWins}</span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs text-text-dim">
                        <span>🇪🇸</span><span>{rider.vueltaWins}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Análise — Corrida pelo topo */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="display-lg">Corrida pelo topo</div>
                <div className="flex flex-col gap-1.5">
                  {ranking.map(r => (
                    <div key={r.username} className="flex items-center gap-1.5 text-xs">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: r.color }} />
                      {r.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-2 border border-border rounded-lg p-4">
                <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="w-full" style={{ height: 160 }}>
                  <line x1={CHART_PAD} y1={CHART_H - CHART_PAD} x2={CHART_W - CHART_PAD} y2={CHART_H - CHART_PAD} stroke="var(--border)" strokeWidth={1} />
                  {series.map(s => (
                    <path
                      key={s.username}
                      d={buildLinePath(s.points, maxWins, CHART_W, CHART_H, CHART_PAD)}
                      stroke={s.color}
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {series.map(s => {
                    const lastVal = s.points[s.points.length - 1] ?? 0
                    const x = CHART_W - CHART_PAD
                    const y = CHART_PAD + (CHART_H - CHART_PAD * 2) - (maxWins === 0 ? 0 : (lastVal / maxWins) * (CHART_H - CHART_PAD * 2))
                    return (
                      <g key={s.username}>
                        <circle cx={x} cy={y} r={9} fill="white" stroke={s.color} strokeWidth={2.5} />
                        <text x={x} y={y + 3.5} textAnchor="middle" fontSize={11} fontWeight={700} fill={s.color}>
                          {s.name.charAt(0)}
                        </text>
                      </g>
                    )
                  })}
                </svg>
                <div className="flex justify-between mt-2 gap-1">
                  {editions.map(ed => (
                    <div key={`${ed.raceKey}-${ed.year}`} className="flex flex-col items-center text-center flex-1 min-w-0">
                      <span className="text-xs">{RACE_INFO[ed.raceKey].flag}</span>
                      <span className="mono text-[8px] font-semibold uppercase text-text-dim leading-tight">
                        {RACE_INFO[ed.raceKey].shortName}<br />&apos;{String(ed.year).slice(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Seletor de edição */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="text-sm font-semibold block mb-1.5">Prova</label>
                <select
                  className="input-field cursor-pointer"
                  value={selectedRace}
                  onChange={e => {
                    const race = e.target.value as RaceKey
                    setSelectedRace(race)
                    const years = editions.filter(ed => ed.raceKey === race).map(ed => ed.year).sort((a, b) => b - a)
                    if (years.length > 0 && !years.includes(selectedYear)) setSelectedYear(years[0])
                    setExpandedKey(null)
                  }}
                >
                  <option value="giro">Giro d&apos;Italia</option>
                  <option value="tour">Tour de France</option>
                  <option value="vuelta">La Vuelta</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1.5">Ano</label>
                <select
                  className="input-field cursor-pointer"
                  value={selectedYear}
                  onChange={e => {
                    setSelectedYear(parseInt(e.target.value, 10))
                    setExpandedKey(null)
                  }}
                >
                  {availableYearsForRace.length === 0 ? (
                    <option value={selectedYear}>{selectedYear}</option>
                  ) : (
                    availableYearsForRace.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Classificação da edição selecionada */}
            {!currentEdition ? (
              <div className="table-wrapper text-center py-14 px-5">
                <div className="text-3xl mb-3 opacity-30">📋</div>
                <div className="text-text-sub text-sm">Ainda não há histórico disponível para esta prova/ano</div>
              </div>
            ) : (
              <>
                <div className="bg-surface-2 border border-border rounded-lg p-4 mb-5">
                  <div className="display-lg mb-2">{RACE_INFO[currentEdition.raceKey].fullName} {currentEdition.year}</div>
                  <span className="badge-categoria">Grande Volta</span>
                </div>

                <div className="flex flex-col gap-2">
                  {currentEdition.standings.map((entry, i) => {
                    const key = `${selectedRace}-${selectedYear}-${entry.username}`
                    const expanded = expandedKey === key
                    const maxLen = Math.max(entry.apostasTop.length, entry.resultadoTop.length)
                    return (
                      <div
                        key={key}
                        className="bg-surface border border-border rounded-md px-4 py-3 cursor-pointer transition-colors"
                        style={expanded ? { background: 'var(--surface-2)', borderColor: 'var(--gold)' } : undefined}
                        onClick={() => setExpandedKey(expanded ? null : key)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`mono font-extrabold text-sm min-w-[20px] ${medalClass(i + 1)}`}>{i + 1}</div>
                          <div className="flex-1 font-semibold text-sm truncate">{entry.name}</div>
                          <div className="mono font-bold text-sm text-text-dim">{entry.points} pts</div>
                          <div
                            className="text-text-sub text-sm transition-transform"
                            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
                          >
                            ▼
                          </div>
                        </div>

                        {expanded && (
                          <div className="mt-4 pt-4 border-t border-border" onClick={e => e.stopPropagation()}>
                            <div className="grid grid-cols-2 gap-5 mb-4">
                              <div>
                                <div className="eyebrow mb-2">Apostou</div>
                                <div className="flex flex-col gap-1.5">
                                  {Array.from({ length: maxLen }).map((_, idx) => {
                                    const bet = entry.apostasTop[idx]
                                    const real = entry.resultadoTop[idx]
                                    const correct = !!bet && !!real && bet.trim().toLowerCase() === real.trim().toLowerCase()
                                    return (
                                      <div key={idx} className={`flex gap-2 text-xs items-center ${correct ? 'font-semibold' : ''}`} style={correct ? { color: 'var(--gold-ink)' } : undefined}>
                                        <span className="mono min-w-[20px]" style={correct ? { color: 'var(--gold-strong)' } : { color: 'var(--text-dim)' }}>{idx + 1}</span>
                                        <span className="truncate">{bet ?? '—'}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                              <div>
                                <div className="eyebrow mb-2">Resultado Real</div>
                                <div className="flex flex-col gap-1.5">
                                  {Array.from({ length: maxLen }).map((_, idx) => {
                                    const bet = entry.apostasTop[idx]
                                    const real = entry.resultadoTop[idx]
                                    const correct = !!bet && !!real && bet.trim().toLowerCase() === real.trim().toLowerCase()
                                    return (
                                      <div key={idx} className={`flex gap-2 text-xs items-center ${correct ? 'font-semibold' : ''}`} style={correct ? { color: 'var(--gold-ink)' } : undefined}>
                                        <span className="mono min-w-[20px]" style={correct ? { color: 'var(--gold-strong)' } : { color: 'var(--text-dim)' }}>{idx + 1}</span>
                                        <span className="truncate">{real ?? '—'}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>

                            {entry.camisolas && (
                              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                                <div className="flex flex-col gap-2">
                                  <div className="eyebrow">Apostou</div>
                                  {entry.camisolas.map(c => {
                                    const acertou = !!c.apostada && !!c.real && c.apostada.trim().toLowerCase() === c.real.trim().toLowerCase()
                                    return (
                                      <div
                                        key={c.tipo}
                                        className="flex flex-col px-2.5 py-2 rounded-md text-xs"
                                        style={{ background: acertou ? 'rgba(243,193,58,0.14)' : 'rgba(208,69,42,0.10)' }}
                                      >
                                        <span className="mono text-[9px] uppercase tracking-wide text-text-dim">{c.tipo}</span>
                                        <span className="font-semibold" style={{ color: acertou ? 'var(--gold-ink)' : 'var(--red)' }}>{c.apostada || '—'}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                                <div className="flex flex-col gap-2">
                                  <div className="eyebrow">Real</div>
                                  {entry.camisolas.map(c => {
                                    const acertou = !!c.apostada && !!c.real && c.apostada.trim().toLowerCase() === c.real.trim().toLowerCase()
                                    return (
                                      <div
                                        key={c.tipo}
                                        className="flex flex-col px-2.5 py-2 rounded-md text-xs"
                                        style={{ background: acertou ? 'rgba(243,193,58,0.14)' : 'rgba(208,69,42,0.10)' }}
                                      >
                                        <span className="mono text-[9px] uppercase tracking-wide text-text-dim">{c.tipo}</span>
                                        <span className="font-semibold" style={{ color: acertou ? 'var(--gold-ink)' : 'var(--red)' }}>{c.real || '—'}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom tab bar */}
      <footer className="sticky bottom-0 z-10 flex justify-around py-3 bg-surface border-t border-border">
        {TABS.map(tab => (
          <Link key={tab.label} href={tab.href} className="flex-1 cursor-pointer">
            <div className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide bottom-nav-item">
              <tab.icon />
              <div>{tab.label}</div>
            </div>
          </Link>
        ))}
      </footer>
    </div>
  )
}
