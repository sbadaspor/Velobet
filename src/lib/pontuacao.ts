/**
 * MOTOR DE PONTUAÇÃO — Sistema de Apostas de Ciclismo
 * Portado do VeloApostas original, sem alterações às regras.
 *
 * Grande Volta / Prova de uma semana (Top-20):
 * - Ciclista apostado no Top-10 E está no Top-10 real → 3 pts
 * - Ciclista apostado no 11-20 E está no 11-20 real → 2 pts
 * - Ciclista apostado no 11-20 E está no Top-10 real → 1 pt (bónus)
 * - Ciclista apostado no Top-10 E está no 11-20 real → 0 pts
 * - Camisolas: 1 pt por acerto
 *
 * Monumento / Prova de um dia (Top-10):
 * - Ciclista apostado está no Top-10 real → 1 pt
 * - Posição exata → +1 pt extra (total 2 pts)
 *
 * Desempate (não dá pontos):
 * 1. Maior nº de posições exatas (total)
 * 2. Maior nº de posições exatas no top alto
 * 3. Maior nº de posições exatas no top baixo
 * 4. Maior nº de camisolas certas
 */

export type CategoriaProvaTipo = 'grande_volta' | 'prova_semana' | 'monumento' | 'prova_dia'

export interface ConfigCategoria {
  temCamisolas: boolean
  numPosicoes: number
  multiEtapas: boolean
  label: string
}

const CONFIGS: Record<CategoriaProvaTipo, ConfigCategoria> = {
  grande_volta: { temCamisolas: true, numPosicoes: 20, multiEtapas: true, label: 'Grande Volta' },
  prova_semana: { temCamisolas: true, numPosicoes: 20, multiEtapas: true, label: 'Prova de uma semana' },
  monumento: { temCamisolas: false, numPosicoes: 10, multiEtapas: false, label: 'Monumento' },
  prova_dia: { temCamisolas: false, numPosicoes: 10, multiEtapas: false, label: 'Prova de um dia' },
}

/** Se a categoria for undefined/null (provas sem categoria definida), usa grande_volta. */
export function getConfigCategoria(categoria?: CategoriaProvaTipo | null): ConfigCategoria {
  return CONFIGS[categoria ?? 'grande_volta']
}

/**
 * Normaliza um nome de ciclista para comparação robusta entre fontes.
 * A startlist (parser do PDF) e a classificação (parser do copy-paste)
 * gravam os nomes com formatos diferentes — sobretudo acentos: a startlist
 * costuma vir sem diacríticos (ex: "Pogacar Tadej") e a classificação com
 * eles (ex: "Pogačar Tadej"). Sem esta normalização o match falhava e o
 * jogador ficava com 0 pontos nesse ciclista.
 *
 * Remove acentos/diacríticos, passa a minúsculas e colapsa espaços.
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove marcas de acento (combining diacritical marks)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export type PontoTipo = 'top10_exato' | 'top20_exato' | 'top10_bonus' | 'top20_bonus' | 'fora' | 'nao_top20'

export interface PontoBreakdownItem {
  ciclista: string
  posicao_apostada: number
  posicao_real: number | null
  pontos: number
  tipo: PontoTipo
  descricao: string
}

export interface CamisolaBreakdown {
  tipo: 'sprint' | 'montanha' | 'juventude'
  apostado: string
  real: string
  acertou: boolean
  pontos: number
}

export interface PontosCalculo {
  pontos_total: number
  pontos_top10: number
  pontos_top20: number
  pontos_camisolas: number
  acertos_exatos: number
  acertos_exatos_top10: number
  acertos_exatos_top20: number
  acertos_camisolas: number
  breakdown: PontoBreakdownItem[]
}

export function calcularPontos(
  apostasTopN: string[],
  resultadoTopN: string[],
  camisolasApostadas: { sprint?: string; montanha?: string; juventude?: string },
  camisolasReais: { sprint?: string; montanha?: string; juventude?: string },
  categoria?: CategoriaProvaTipo | null
): PontosCalculo {
  const config = getConfigCategoria(categoria)
  const numPos = config.numPosicoes
  const isSimples = categoria === 'monumento' || categoria === 'prova_dia'
  const topAlto = 10
  const topBaixo = 20

  const breakdown: PontoBreakdownItem[] = []
  let pontos_top10 = 0
  let pontos_top20 = 0
  let acertos_exatos = 0
  let acertos_exatos_top10 = 0
  let acertos_exatos_top20 = 0

  // Mapa: ciclista (normalizado) -> posição real (1-indexed).
  // Usa normalizarNome para os nomes baterem certo entre a startlist
  // (com que se aposta) e a classificação (com que se pontua), mesmo
  // com diferenças de acentos/maiúsculas.
  const posicaoReal = new Map<string, number>()
  resultadoTopN.forEach((ciclista, idx) => {
    if (ciclista && ciclista.trim()) posicaoReal.set(normalizarNome(ciclista), idx + 1)
  })

  apostasTopN.forEach((ciclista, idx) => {
    if (!ciclista || !ciclista.trim()) return
    if (idx >= numPos) return

    const nomeLower = normalizarNome(ciclista)
    const posApostada = idx + 1
    const posReal = posicaoReal.get(nomeLower) ?? null

    let pontos = 0
    let tipo: PontoBreakdownItem['tipo'] = 'nao_top20'
    let descricao = ''

    if (isSimples) {
      // ── Monumento / Prova de um dia ──────────────────
      if (posReal === null) {
        tipo = 'nao_top20'
        pontos = 0
        descricao = `Não entrou no Top-${numPos}`
      } else {
        const exato = posApostada === posReal
        if (exato) {
          pontos = 2
          tipo = 'top10_exato'
          acertos_exatos++
          acertos_exatos_top10++
          descricao = `Apostado ${posApostada}º, terminou ${posReal}º ✓ Posição Exata!`
        } else {
          pontos = 1
          tipo = 'top10_bonus'
          descricao = `Apostado ${posApostada}º, terminou ${posReal}º`
        }
        pontos_top10 += pontos
      }
    } else {
      // ── Grande Volta / Prova de uma semana ───────────
      const apostadoNoAlto = posApostada <= topAlto
      const apostadoNoBaixo = posApostada > topAlto && posApostada <= topBaixo
      const realNoAlto = posReal !== null && posReal <= topAlto
      const realNoBaixo = posReal !== null && posReal > topAlto && posReal <= topBaixo

      if (posReal === null) {
        tipo = 'nao_top20'
        pontos = 0
        descricao = `Não entrou no Top-${topBaixo}`
      } else if (apostadoNoAlto && realNoAlto) {
        pontos = 3
        tipo = 'top10_exato'
        descricao = `Apostado ${posApostada}º, terminou ${posReal}º`
        if (posApostada === posReal) {
          acertos_exatos++
          acertos_exatos_top10++
          descricao += ' ✓ Posição Exata!'
        }
        pontos_top10 += pontos
      } else if (apostadoNoBaixo && realNoBaixo) {
        pontos = 2
        tipo = 'top20_exato'
        descricao = `Apostado ${posApostada}º, terminou ${posReal}º`
        if (posApostada === posReal) {
          acertos_exatos++
          acertos_exatos_top20++
          descricao += ' ✓ Posição Exata!'
        }
        pontos_top20 += pontos
      } else if (apostadoNoBaixo && realNoAlto) {
        pontos = 1
        tipo = 'top10_bonus'
        descricao = `Apostado ${posApostada}º, terminou ${posReal}º (bónus)`
        pontos_top20 += pontos
      } else if (apostadoNoAlto && realNoBaixo) {
        pontos = 0
        tipo = 'top20_bonus'
        descricao = `Apostado ${posApostada}º, terminou ${posReal}º (sem pontos)`
        pontos_top10 += pontos
      } else {
        tipo = 'fora'
        pontos = 0
        descricao = `Apostado ${posApostada}º, terminou ${posReal}º`
      }
    }

    breakdown.push({
      ciclista: ciclista.trim(),
      posicao_apostada: posApostada,
      posicao_real: posReal,
      pontos,
      tipo,
      descricao,
    })
  })

  const camisolaBreakdowns = config.temCamisolas
    ? calcularCamisolas(camisolasApostadas, camisolasReais)
    : []
  const pontos_camisolas = camisolaBreakdowns.reduce((sum, c) => sum + c.pontos, 0)
  const acertos_camisolas = camisolaBreakdowns.filter(c => c.acertou).length

  const pontos_total = pontos_top10 + pontos_top20 + pontos_camisolas

  return {
    pontos_total,
    pontos_top10,
    pontos_top20,
    pontos_camisolas,
    acertos_exatos,
    acertos_exatos_top10,
    acertos_exatos_top20,
    acertos_camisolas,
    breakdown,
  }
}

export function calcularCamisolas(
  apostadas: { sprint?: string; montanha?: string; juventude?: string },
  reais: { sprint?: string; montanha?: string; juventude?: string }
): CamisolaBreakdown[] {
  const tipos = [
    { tipo: 'sprint' as const },
    { tipo: 'montanha' as const },
    { tipo: 'juventude' as const },
  ]

  return tipos.map(({ tipo }) => {
    const apostado = apostadas[tipo] ?? ''
    const real = reais[tipo] ?? ''
    const acertou = normalizarNome(apostado) === normalizarNome(real) && apostado.trim() !== ''
    return {
      tipo,
      apostado: apostado.trim(),
      real: real.trim(),
      acertou,
      pontos: acertou ? 1 : 0,
    }
  })
}

export function compararDesempate(
  a: {
    pontos_total: number
    acertos_exatos: number
    acertos_exatos_top10: number
    acertos_exatos_top20: number
    acertos_camisolas: number
  },
  b: {
    pontos_total: number
    acertos_exatos: number
    acertos_exatos_top10: number
    acertos_exatos_top20: number
    acertos_camisolas: number
  }
): number {
  if (b.pontos_total !== a.pontos_total) return b.pontos_total - a.pontos_total
  if (b.acertos_exatos !== a.acertos_exatos) return b.acertos_exatos - a.acertos_exatos
  if (b.acertos_exatos_top10 !== a.acertos_exatos_top10) return b.acertos_exatos_top10 - a.acertos_exatos_top10
  if (b.acertos_exatos_top20 !== a.acertos_exatos_top20) return b.acertos_exatos_top20 - a.acertos_exatos_top20
  return b.acertos_camisolas - a.acertos_camisolas
}
