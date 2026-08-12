'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getConfigCategoria, type CategoriaProvaTipo } from '@/lib/pontuacao'
import { JerseyCircle, getJerseyPalette, getJerseyLabel, type JerseyTipo } from '@/components/JerseyBadge'

type ProvaInfo = {
  id: string
  nome: string
  categoria: CategoriaProvaTipo | null
  status: 'aberta' | 'fechada' | 'finalizada'
}

type Ciclista = {
  nome: string
  equipa: string
  dorsal: number | null
}

type SearchMode = { kind: 'posicao'; index: number } | { kind: 'camisola'; tipo: JerseyTipo } | null

const JERSEY_TIPOS: JerseyTipo[] = ['sprint', 'montanha', 'juventude']
const NUM_POSICOES = 20

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase()
}

export default function ApostarPage() {
  const params = useParams<{ id: string }>()
  const provaId = params.id
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [prova, setProva] = useState<ProvaInfo | null>(null)
  const [startlist, setStartlist] = useState<Ciclista[]>([])
  const [positions, setPositions] = useState<(string | null)[]>(Array(NUM_POSICOES).fill(null))
  const [camisolas, setCamisolas] = useState<Record<JerseyTipo, string | null>>({ sprint: null, montanha: null, juventude: null })
  const [search, setSearch] = useState<SearchMode>(null)
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState(false)

  const userIdRef = useRef<string | null>(null)
  const hydrated = useRef(false)

  // No iOS Safari, a barra do teclado (setas + "concluído") fica fixa no
  // ecrã e não empurra o layout — sem isto, a lista de pesquisa fica
  // parcialmente escondida por trás dela. O visualViewport dá-nos a altura
  // real ainda visível (já sem o teclado) para ajustarmos o painel.
  const [alturaVisivel, setAlturaVisivel] = useState<number | null>(null)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const atualizar = () => setAlturaVisivel(vv.height)
    atualizar()
    vv.addEventListener('resize', atualizar)
    return () => vv.removeEventListener('resize', atualizar)
  }, [])

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null
      userIdRef.current = uid

      const [{ data: provaData }, { data: startlistData }, apostaResult] = await Promise.all([
        supabase.from('provas').select('id, nome, categoria, status').eq('id', provaId).single(),
        supabase.from('ciclistas_prova').select('nome, equipa, dorsal').eq('prova_id', provaId).order('nome', { ascending: true }),
        uid
          ? supabase
              .from('apostas')
              .select('apostas_top20, camisola_sprint, camisola_montanha, camisola_juventude')
              .eq('prova_id', provaId)
              .eq('user_id', uid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      setProva((provaData as ProvaInfo) ?? null)
      setStartlist((startlistData ?? []) as Ciclista[])

      const aposta = apostaResult.data as {
        apostas_top20: string[] | null
        camisola_sprint: string | null
        camisola_montanha: string | null
        camisola_juventude: string | null
      } | null

      if (aposta) {
        const top20 = aposta.apostas_top20 ?? []
        setPositions(Array.from({ length: NUM_POSICOES }, (_, i) => (top20[i] && top20[i].trim() ? top20[i] : null)))
        setCamisolas({
          sprint: aposta.camisola_sprint?.trim() || null,
          montanha: aposta.camisola_montanha?.trim() || null,
          juventude: aposta.camisola_juventude?.trim() || null,
        })
      }

      setLoading(false)
      // evita que o autosave dispare com os valores que acabámos de carregar
      setTimeout(() => { hydrated.current = true }, 0)
    })()
  }, [provaId])

  const config = prova ? getConfigCategoria(prova.categoria) : null
  const suportado = config ? config.numPosicoes === NUM_POSICOES && config.temCamisolas : false
  const podeApostar = !!prova && prova.status === 'aberta' && suportado && startlist.length > 0

  async function salvarRascunho() {
    const uid = userIdRef.current
    if (!uid || !prova) return
    const supabase = createClient()
    await supabase.from('apostas').upsert(
      {
        prova_id: prova.id,
        user_id: uid,
        apostas_top20: positions.map(p => p ?? ''),
        camisola_sprint: camisolas.sprint ?? '',
        camisola_montanha: camisolas.montanha ?? '',
        camisola_juventude: camisolas.juventude ?? '',
      },
      { onConflict: 'prova_id,user_id' }
    )
  }

  // Rascunho automático a cada alteração (só depois de carregar os dados iniciais).
  useEffect(() => {
    if (!hydrated.current || !podeApostar) return
    const timeout = setTimeout(() => { void salvarRascunho() }, 600)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, camisolas])

  const equipaPorNome = useMemo(() => {
    const m = new Map<string, string>()
    startlist.forEach(c => m.set(c.nome.toLowerCase(), c.equipa))
    return m
  }, [startlist])

  const startlistFiltrada = useMemo(() => {
    const q = query.trim().toLowerCase()
    const usadosNoTop20 = new Set(positions.filter(Boolean).map(n => (n as string).toLowerCase()))
    return startlist
      .filter(c => !q || c.nome.toLowerCase().includes(q) || c.equipa.toLowerCase().includes(q))
      .map(c => ({ ...c, jaEscolhido: search?.kind === 'posicao' && usadosNoTop20.has(c.nome.toLowerCase()) }))
  }, [startlist, query, positions, search])

  const totalEscolhidos = positions.filter(Boolean).length
  const camisolasEscolhidas = JERSEY_TIPOS.filter(t => camisolas[t]).length
  const completo = totalEscolhidos === NUM_POSICOES && camisolasEscolhidas === 3

  function abrirBuscaPosicao(index: number) {
    setSearch({ kind: 'posicao', index })
    setQuery('')
  }
  function abrirBuscaCamisola(tipo: JerseyTipo) {
    setSearch({ kind: 'camisola', tipo })
    setQuery('')
  }
  function fecharBusca() {
    setSearch(null)
    setQuery('')
  }
  function removerPosicao(index: number) {
    setPositions(prev => prev.map((p, i) => (i === index ? null : p)))
  }
  function moverPosicao(index: number, direcao: -1 | 1) {
    const to = index + direcao
    if (to < 0 || to >= NUM_POSICOES) return
    setPositions(prev => {
      const next = [...prev]
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })
  }
  function removerCamisola(tipo: JerseyTipo) {
    setCamisolas(prev => ({ ...prev, [tipo]: null }))
  }
  function escolherCiclista(nome: string) {
    if (!search) return
    if (search.kind === 'posicao') {
      setPositions(prev => prev.map((p, i) => (i === search.index ? nome : p)))
    } else {
      setCamisolas(prev => ({ ...prev, [search.tipo]: nome }))
    }
    fecharBusca()
  }

  async function handleConfirmar() {
    setConfirming(true)
    await salvarRascunho()
    setConfirming(false)
    router.push('/proximas')
  }

  if (loading) return null

  if (!prova) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-5 text-center text-sm text-text-dim">
        Prova não encontrada.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-32">
      <header className="sticky top-0 z-10 flex items-center gap-4 px-5 py-4 bg-surface border-b border-border">
        <button
          className="text-sm font-semibold text-text hover:text-gold-strong transition-colors"
          onClick={() => router.push('/proximas')}
        >
          ← Voltar
        </button>
        <div className="flex-1 text-center text-sm font-semibold pr-14 truncate">{prova.nome}</div>
      </header>

      <div className="max-w-[560px] mx-auto px-5 py-6">
        {prova.status !== 'aberta' ? (
          <div className="table-wrapper text-center py-14 px-5">
            <div className="text-text-sub text-sm">As apostas para esta prova já não estão abertas.</div>
          </div>
        ) : !suportado ? (
          <div className="table-wrapper text-center py-14 px-5">
            <div className="text-text-sub text-sm">Este tipo de prova ainda não é suportado neste ecrã.</div>
          </div>
        ) : startlist.length === 0 ? (
          <div className="table-wrapper text-center py-14 px-5">
            <div className="text-text-sub text-sm">Ainda não há startlist carregada para esta prova.</div>
          </div>
        ) : (
          <>
            <div className="eyebrow mb-2">{config?.label}</div>
            <div className="display-lg mb-4">A tua aposta</div>

            <div className="flex items-center justify-between px-4 py-3 mb-6 bg-surface-2 border border-border rounded-md">
              <div className="mono text-base font-bold">{totalEscolhidos}/{NUM_POSICOES}</div>
              <div className="text-xs text-text-dim">{completo ? 'Completa' : 'Rascunho'}</div>
            </div>

            <div className="flex flex-col gap-2 mb-8">
              {positions.map((cyclistName, i) => {
                const isMedal = i < 3
                const equipa = cyclistName ? equipaPorNome.get(cyclistName.toLowerCase()) : undefined
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 bg-surface-2 border border-border rounded-md">
                    <div
                      className="mono text-sm font-bold flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: isMedal ? 'var(--gold)' : 'var(--surface)',
                        color: isMedal ? 'var(--gold-ink)' : 'var(--text)',
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {cyclistName ? (
                        <>
                          <div className="text-sm font-semibold truncate">{cyclistName}</div>
                          {equipa && <div className="text-xs text-text-dim truncate">{equipa}</div>}
                        </>
                      ) : (
                        <div className="text-sm text-text-sub">Toca para escolher</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {cyclistName ? (
                        <>
                          <button className="text-text-dim hover:text-text px-1.5 disabled:opacity-30" disabled={i === 0} onClick={() => moverPosicao(i, -1)} aria-label="Subir">↑</button>
                          <button className="text-text-dim hover:text-text px-1.5 disabled:opacity-30" disabled={i === NUM_POSICOES - 1} onClick={() => moverPosicao(i, 1)} aria-label="Descer">↓</button>
                          <button className="text-text-dim hover:text-text px-1.5" onClick={() => removerPosicao(i)} aria-label="Remover">✕</button>
                        </>
                      ) : (
                        <button className="text-text-dim hover:text-text font-semibold px-1.5" onClick={() => abrirBuscaPosicao(i)} aria-label="Adicionar">+</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mb-8">
              <div className="display-lg mb-3" style={{ fontSize: 18 }}>Camisolas</div>
              <div className="flex flex-col gap-2">
                {JERSEY_TIPOS.map(tipo => {
                  const escolhido = camisolas[tipo]
                  return (
                    <div
                      key={tipo}
                      className="flex items-center gap-3 px-4 py-3 bg-surface-2 border border-border rounded-md cursor-pointer hover:bg-surface-3"
                      onClick={() => abrirBuscaCamisola(tipo)}
                    >
                      <JerseyCircle palette={getJerseyPalette(prova.nome, tipo)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{getJerseyLabel(prova.nome, tipo)}</div>
                        <div className="text-xs text-text-dim truncate">{escolhido || 'Toca para escolher'}</div>
                      </div>
                      {escolhido && (
                        <button
                          className="text-text-dim hover:text-text px-1.5"
                          onClick={e => { e.stopPropagation(); removerCamisola(tipo) }}
                          aria-label="Remover"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {podeApostar && (
        <div className="fixed bottom-0 left-0 right-0 px-5 pb-5 pt-6" style={{ background: 'linear-gradient(to top, var(--bg) 60%, transparent)' }}>
          <div className="max-w-[560px] mx-auto">
            <div className="text-center text-xs text-text-dim mb-2">
              {totalEscolhidos}/{NUM_POSICOES} ciclistas · {camisolasEscolhidas}/3 camisolas
            </div>
            <button className="btn-primary w-full" disabled={!completo || confirming} onClick={handleConfirmar}>
              {confirming ? 'A confirmar…' : 'Confirmar aposta'}
            </button>
          </div>
        </div>
      )}

      {search && (
        <div
          className="fixed inset-x-0 top-0 z-30 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', height: alturaVisivel ? `${alturaVisivel}px` : '100vh' }}
          onClick={fecharBusca}
        >
          <div
            className="w-full max-w-[560px] bg-surface rounded-t-xl flex flex-col"
            style={{ maxHeight: '90%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <input
                autoFocus
                className="input-field flex-1"
                placeholder="Pesquisar ciclista..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button className="text-text-dim hover:text-text text-lg px-1" onClick={fecharBusca} aria-label="Fechar">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {startlistFiltrada.length === 0 ? (
                <div className="text-center text-sm text-text-sub py-8">Nenhum ciclista encontrado</div>
              ) : (
                startlistFiltrada.map(c => (
                  <button
                    key={c.nome}
                    disabled={c.jaEscolhido}
                    className="flex items-center gap-3 px-4 py-3 bg-surface-2 rounded-md text-left disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-3"
                    onClick={() => escolherCiclista(c.nome)}
                  >
                    <div
                      className="mono text-xs font-semibold flex items-center justify-center flex-shrink-0"
                      style={{ width: 36, height: 36, borderRadius: '999px', background: 'var(--surface-3)' }}
                    >
                      {iniciais(c.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{c.nome}</div>
                      <div className="text-xs text-text-dim truncate">{c.equipa}{c.dorsal ? ` · #${c.dorsal}` : ''}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
