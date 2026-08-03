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
 * Processa uma tabela de classificação (GC, Points, KOM, Youth ou
 * Stage) copiada do procyclingstats. Aceita dois formatos, porque o
 * copiar-colar real do site espalha cada ciclista por DUAS linhas:
 *
 *   1	 Milan Jonathan
 *   Lidl - Trek	8	10″	5:04:01
 *
 * (posição+nome numa linha, equipa+...+tempo na seguinte) — mas
 * também aceita tudo numa única linha separada por tabs, para colagens
 * de outras fontes. "," ou "″" sozinhos na coluna do tempo significam
 * "igual ao ciclista anterior" — herda o tempo anterior.
 */
export function parseClassificacao(texto: string): LinhaClassificacao[] {
  const linhas = texto
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const resultado: LinhaClassificacao[] = []
  let ultimoTempo = ''
  let i = 0

  while (i < linhas.length) {
    const linha = linhas[i]
    if (/^rnk\b/i.test(linha)) { i++; continue } // cabeçalho da tabela

    const colsLinha = linha.split('\t').map(c => c.trim()).filter(c => c !== '')
    const primeiraCol = colsLinha[0] ?? ''
    const posMatch = primeiraCol.match(/^(\d+)/)
    if (!posMatch) { i++; continue }
    const posicao = parseInt(posMatch[1], 10)

    let nome = ''
    let equipa = ''
    let tempoBruto = ''

    if (colsLinha.length >= 3) {
      // Tudo numa única linha: posição, nome, [equipa,] ..., tempo
      nome = colsLinha[1]
      equipa = colsLinha.length > 2 ? colsLinha[2] : ''
      tempoBruto = colsLinha[colsLinha.length - 1]
      i += 1
    } else {
      // Nome nesta linha; equipa + tempo vêm na linha seguinte
      nome = colsLinha[1] ?? primeiraCol.replace(/^\d+/, '')
      const proxima = linhas[i + 1]
      if (proxima && !/^\d+(\s|\t)/.test(proxima)) {
        const colsProxima = proxima.split('\t').map(c => c.trim()).filter(c => c !== '')
        if (colsProxima.length > 0) {
          equipa = colsProxima[0]
          tempoBruto = colsProxima[colsProxima.length - 1]
        }
        i += 2
      } else {
        i += 1
      }
    }

    nome = nome.replace(/^[^\p{L}]*/u, '').trim()
    if (!nome) continue

    const tempo = /^[,″]+$/.test(tempoBruto) ? ultimoTempo : tempoBruto
    if (tempo) ultimoTempo = tempo

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
