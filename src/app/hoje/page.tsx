'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// Vazio até a etapa finalizar e existirem resultados reais.
const classificacaoTop20: { posicao: number; nome: string; tempo: string }[] = []

function formatarData(date: Date) {
  return {
    diaSemana: DIAS[date.getDay()],
    dataStr: `${date.getDate()} ${MESES[date.getMonth()]}`,
  }
}

function formatarHora(date: Date) {
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function isoHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function diasAte(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = parseISODate(iso)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function badgeClass(status: string) {
  if (status === 'A decorrer') return 'badge-a-decorrer'
  if (status === 'Finalizada') return 'badge-finalizada'
  return 'badge-brevemente'
}

function medalClass(pos: number) {
  if (pos === 1) return 'text-medal-1'
  if (pos === 2) return 'text-medal-2'
  if (pos === 3) return 'text-medal-3'
  return 'text-text'
}

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

const TABS: { label: string; icon: () => React.ReactElement; active: boolean; href: string | null }[] = [
  { label: 'Hoje', icon: HomeIcon, active: true, href: '/hoje' },
  { label: 'Próximas', icon: CalendarIcon, active: false, href: '/proximas' },
  { label: 'Classificação', icon: StarIcon, active: false, href: '/classificacao' },
  { label: 'Eu', icon: UserIcon, active: false, href: '/perfil' },
]

type ProvaRow = {
  id: string
  nome: string
  data_inicio: string
  data_fim: string
  status: 'aberta' | 'fechada' | 'finalizada'
}

type EtapaRow = {
  id: string
  prova_id: string
  numero_etapa: number
  perfil: string | null
  distancia_km: number | null
  elevacao_m: number | null
  local_partida: string | null
  local_chegada: string | null
  data_etapa: string
}

type ProximaEtapa = {
  numero: number
  titulo: string
  distancia: number | null
  elevacao: number | null
  status: 'Brevemente' | 'A decorrer'
  daysLeft: number
}

export default function HojePage() {
  const [now, setNow] = useState<Date | null>(null)
  const [userName, setUserName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const [dadosCarregados, setDadosCarregados] = useState(false)
  const [provas, setProvas] = useState<ProvaRow[]>([])
  const [etapas, setEtapas] = useState<EtapaRow[]>([])

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return

      const { data: perfil } = await supabase
        .from('perfis')
        .select('full_name, username, avatar_url')
        .eq('id', uid)
        .single()

      const nome = perfil?.full_name || perfil?.username || userData.user?.email?.split('@')[0] || ''
      setUserName(nome)
      setAvatarUrl(perfil?.avatar_url ?? null)
    })()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
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
          .select('id, prova_id, numero_etapa, perfil, distancia_km, elevacao_m, local_partida, local_chegada, data_etapa')
          .in('prova_id', provasList.map(p => p.id))
          .order('data_etapa', { ascending: true })

        setEtapas((etapasData ?? []) as EtapaRow[])
      }

      setDadosCarregados(true)
    })()
  }, [])

  const proximaEtapa = useMemo<ProximaEtapa | null>(() => {
    const hoje = isoHoje()
    const candidatas = etapas
      .filter(e => e.data_etapa >= hoje)
      .sort((a, b) => (a.data_etapa < b.data_etapa ? -1 : a.data_etapa > b.data_etapa ? 1 : a.numero_etapa - b.numero_etapa))

    const candidata = candidatas[0]
    if (!candidata) return null

    const prova = provas.find(p => p.id === candidata.prova_id)
    const isHoje = candidata.data_etapa === hoje

    return {
      numero: candidata.numero_etapa,
      titulo: candidata.local_chegada || `Etapa ${candidata.numero_etapa}`,
      distancia: candidata.distancia_km,
      elevacao: candidata.elevacao_m,
      status: isHoje || prova?.status === 'fechada' ? 'A decorrer' : 'Brevemente',
      daysLeft: diasAte(candidata.data_etapa),
    }
  }, [etapas, provas])

  if (!now || !dadosCarregados) return null

  const { diaSemana, dataStr } = formatarData(now)
  const hora = formatarHora(now)

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

      {/* Conteúdo */}
      <div className="max-w-[560px] mx-auto px-5 py-5 flex-1 w-full">
        <div className="eyebrow mb-3">{diaSemana}, {dataStr} · {hora}</div>
        <div className="display-2xl mb-2">Olá, {userName || '...'}.</div>
        <div className="text-sm text-text-dim mb-6">
          {proximaEtapa
            ? proximaEtapa.daysLeft <= 0
              ? 'A etapa é hoje'
              : `Faltam ${proximaEtapa.daysLeft} dia${proximaEtapa.daysLeft === 1 ? '' : 's'} para a próxima etapa`
            : 'Sem etapas agendadas'}
        </div>

        {/* Card hero */}
        {proximaEtapa ? (
          <div className="card-hero mb-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="eyebrow eyebrow-on-ink">Próxima etapa · Etapa {proximaEtapa.numero}</div>
                <div className="display-xl mt-2.5" style={{ fontSize: 26 }}>{proximaEtapa.titulo}</div>
              </div>
              <span className={`badge-status ${badgeClass(proximaEtapa.status)}`}>
                <span className="dot" />{proximaEtapa.status}
              </span>
            </div>

            <div className="divider" />

            <div className="flex justify-center gap-6">
              <div className="flex flex-col items-center text-center">
                <div className="eyebrow eyebrow-on-ink">Dist.</div>
                <div className="stat-md text-on-ink mt-1" style={{ fontSize: 22 }}>
                  {proximaEtapa.distancia ?? '—'}<span className="stat-unit text-on-ink-dim ml-1">km</span>
                </div>
              </div>
              <div className="flex flex-col items-center text-center border-l border-on-ink-border pl-6">
                <div className="eyebrow eyebrow-on-ink">Asc.</div>
                <div className="stat-md text-on-ink mt-1" style={{ fontSize: 22 }}>
                  {proximaEtapa.elevacao ?? '—'}<span className="stat-unit text-on-ink-dim ml-1">m</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper text-center py-10 px-5 mb-6">
            <div className="text-text-sub text-sm">Sem etapas agendadas</div>
          </div>
        )}

        <div className="text-sm font-semibold text-text-dim mt-8 mb-4">
          Classificação Top 20 — Geral da etapa
        </div>

        {classificacaoTop20.length === 0 ? (
          <div className="table-wrapper text-center py-10 px-5">
            <div className="text-text-sub text-sm">Ainda sem resultados</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Ciclista</th>
                  <th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {classificacaoTop20.map(row => (
                  <tr key={row.posicao}>
                    <td className={`mono font-extrabold ${medalClass(row.posicao)}`}>{row.posicao}</td>
                    <td className="font-semibold">{row.nome}</td>
                    <td className="mono font-semibold">{row.tempo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <footer className="sticky bottom-0 z-10 flex justify-around py-3 bg-surface border-t border-border">
        {TABS.map(tab => {
          const content = (
            <div className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide bottom-nav-item ${tab.active ? 'active' : ''}`}>
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
