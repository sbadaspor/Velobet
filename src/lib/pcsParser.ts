/**
 * Processamento de texto colado do procyclingstats (ou fonte
 * semelhante) — usado tanto pela importação automática (HTML
 * convertido em texto) como pelo "colar e processar" manual no Admin.
 *
 * Não faz nenhum pedido de rede — recebe sempre texto já extraído.
 */

export type LinhaClassificacao = {
  posicao: number
  nome: string
  equipa: string
  tempo: string
}

export type LinhaStartlist = {
  nome: string
  equipa: string
  dorsal: number | null
  dnf: boolean
  etapaAbandono: number | null
}

/**
 * Processa uma tabela de classificação (GC, Points, KOM ou Youth) —
 * formato: posição, nome do ciclista, equipa, ... , tempo. Aceita
 * colunas separadas por tab (copiar de uma tabela HTML) ou por
 * múltiplos espaços.
 */
export function parseClassificacao(texto: string): LinhaClassificacao[] {
  const linhas = texto
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const resultado: LinhaClassificacao[] = []

  for (const linha of linhas) {
    if (/^rnk\b/i.test(linha)) continue // cabeçalho da tabela

    let cols = linha.split('\t').map(c => c.trim()).filter(c => c !== '')
    if (cols.length < 2) {
      cols = linha.split(/\s{2,}/).map(c => c.trim()).filter(Boolean)
    }
    if (cols.length < 2) continue

    const posMatch = cols[0].match(/^(\d+)/)
    if (!posMatch) continue

    const posicao = parseInt(posMatch[1], 10)
    // remove bandeiras/emojis no início do nome
    const nome = cols[1].replace(/^[^\p{L}]*/u, '').trim()
    if (!nome) continue

    const equipa = cols.length > 3 ? cols[2] : cols.length === 3 ? cols[2] : ''
    const tempo = cols[cols.length - 1] ?? ''

    resultado.push({ posicao, nome, equipa, tempo })
  }

  return resultado.sort((a, b) => a.posicao - b.posicao)
}

/**
 * Processa uma startlist (agrupada por equipa) — formato:
 * "Nome da Equipa (WT)" seguida de linhas "dorsal NOME Apelido",
 * podendo ter "*" (estreante) ou "(DNF #N)" (abandonou na etapa N).
 */
export function parseStartlist(texto: string): LinhaStartlist[] {
  const linhas = texto
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const resultado: LinhaStartlist[] = []
  let equipaAtual = ''

  const riderRegex = /^(\d+)\s+([\p{L}\p{M}' .\-]+?)(\*)?(?:\s*\(DNF\s*#?(\d+)\))?$/u
  const ignorarRegex = /^(DS|team statistics|startlist|results stage|more pdf|menu|ranked|more)/i

  for (const linha of linhas) {
    const m = linha.match(riderRegex)
    if (m) {
      const dorsal = parseInt(m[1], 10)
      const nome = m[2].trim()
      const dnf = !!m[4]
      const etapaAbandono = m[4] ? parseInt(m[4], 10) : null
      resultado.push({ nome, equipa: equipaAtual, dorsal, dnf, etapaAbandono })
    } else if (!ignorarRegex.test(linha)) {
      // linha que não é um ciclista — assume-se cabeçalho de equipa
      equipaAtual = linha.replace(/\s*\(WT\)\s*$/i, '').trim()
    }
  }

  return resultado
}

/** Primeira linha (posição 1) de uma classificação = líder dessa camisola. */
export function liderDaClassificacao(linhas: LinhaClassificacao[]): string | null {
  const primeiro = linhas.find(l => l.posicao === 1)
  return primeiro?.nome ?? null
}
