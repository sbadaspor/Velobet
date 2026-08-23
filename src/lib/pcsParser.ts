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

  // Uma coluna é "marca de variação" quando começa por seta/igual (▲3, ▼152,
  // =) — aparece a partir da 2ª etapa. É "número puro" quando é só dígitos
  // (rank anterior / dorsal). O nome é a 1ª coluna que tem letras e não é
  // nenhuma destas.
  const ehMudanca = (s: string) => /^[▲▼△▽▴▾⏶⏷=+\-]/.test(s.trim())
  const ehNumero = (s: string) => /^\d+$/.test(s.trim())
  const temLetra = (s: string) => /\p{L}/u.test(s)

  while (i < linhas.length) {
    const linha = linhas[i]
    if (/^rnk\b/i.test(linha)) { i++; continue } // cabeçalho da tabela

    const cols = linha.split('\t').map(c => c.trim()).filter(c => c !== '')
    const primeiraCol = cols[0] ?? ''
    const posMatch = primeiraCol.match(/^(\d+)/)
    if (!posMatch) { i++; continue }
    const posicao = parseInt(posMatch[1], 10)

    let nome = ''
    let equipa = ''
    let tempoBruto = ''

    if (cols.length >= 2) {
      // Formato por colunas (tabs). Encontra a coluna do nome: a 1ª coluna
      // (a partir da 2ª) com letras que não seja número puro nem marca de
      // variação — assim salta "rank anterior" e a seta ▲/▼ das etapas 2+.
      let nameIdx = -1
      for (let k = 1; k < cols.length; k++) {
        const c = cols[k]
        if (temLetra(c) && !ehMudanca(c) && !ehNumero(c)) { nameIdx = k; break }
      }
      if (nameIdx === -1) { i++; continue }

      nome = cols[nameIdx]
      if (nameIdx < cols.length - 1) {
        // Tudo na mesma linha: equipa a seguir ao nome, tempo na última coluna.
        equipa = cols[nameIdx + 1] ?? ''
        tempoBruto = cols[cols.length - 1]
        i += 1
      } else {
        // Nome é a última coluna → equipa + tempo vêm na linha seguinte.
        const proxima = linhas[i + 1]
        if (proxima && !/^\d/.test(proxima.trim())) {
          const colsP = proxima.split('\t').map(c => c.trim()).filter(Boolean)
          if (colsP.length > 0) {
            equipa = colsP[0]
            tempoBruto = colsP[colsP.length - 1]
          }
          i += 2
        } else {
          i += 1
        }
      }
    } else {
      // Uma só coluna (separada por espaços, sem tabs). Descasca a linha:
      // rank [rankAnterior] [▲▼= variação] Nome…  — equipa/tempo na linha
      // seguinte.
      const m = primeiraCol.match(/^(\d+)\s+(?:\d+\s+)?(?:[▲▼△▽▴▾⏶⏷=+\-]\s*\d*\s+)?(.*)$/u)
      nome = (m?.[2] ?? '').trim()
      const proxima = linhas[i + 1]
      if (proxima && !/^\d/.test(proxima.trim())) {
        const tempoM = proxima.trim().match(/([,″]+|\d[\d:.'"hms ]*\d|\d+)\s*$/)
        equipa = proxima.trim()
        tempoBruto = tempoM ? tempoM[1].trim() : ''
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

/**
 * Processa o texto extraído do PDF de startlist do procyclingstats
 * (download direto do botão "PDF" na página da startlist). Formato
 * observado (uma linha por entrada, sem espaços):
 *
 *   1UAE Team Emirates - XRG
 *   1.ALMEIDA Joao
 *   2.BJERG Mikkel
 *   ...
 *   11Red Bull - BORA -
 *   hansgrohe
 *   101.BOICHIS Adrien
 *
 * Uma linha de equipa é "número + texto" (sem ponto a seguir ao
 * número); uma linha de ciclista é "número + ponto + nome". Nomes de
 * equipa ou de ciclista que quebram para a linha seguinte (por serem
 * compridos) são detetados como "linha de continuação" (não começa
 * por número) e anexados à entrada anterior.
 *
 * Cada equipa termina com uma ou mais linhas "DS: Nome1,Nome2" (staff/
 * diretores desportivos) — não são ciclistas e não entram na startlist.
 * Essas linhas também podem quebrar para a linha seguinte (ex.: "DS:
 * BRAMBILLA Gianluca,SANS VEGA" + continuação "Alexandre") tal como os
 * nomes de equipa/ciclista, por isso é preciso um 3º estado ("staff")
 * para as continuações desse bloco também serem ignoradas em vez de
 * ficarem coladas ao nome do último ciclista lido.
 */
export function parsePdfStartlistTexto(texto: string): LinhaStartlist[] {
  const linhas = texto
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const resultado: LinhaStartlist[] = []
  let equipaAtual = ''
  let ultimoTipo: 'equipa' | 'ciclista' | 'staff' | null = null
  let ultimoNumeroEquipa = 0

  const riderRegex = /^(\d+)\.(.+)$/
  const teamRegex = /^(\d{1,3})(\D.+)$/
  const dataRegex = /^\d{1,2}\/\d{1,2}\/\d{4}\b/
  const ignorarRegex = /procyclingstats/i
  const staffRegex = /^DS\s*:/i

  for (const linha of linhas) {
    if (dataRegex.test(linha) || ignorarRegex.test(linha)) continue

    // "DS: Nome1,Nome2" — staff da equipa (diretor desportivo), não é
    // ciclista. Marca o estado para as linhas de continuação seguintes
    // (nomes que quebraram) também serem ignoradas, em vez de ficarem
    // coladas ao nome do último ciclista lido.
    if (staffRegex.test(linha)) {
      ultimoTipo = 'staff'
      continue
    }

    const riderMatch = linha.match(riderRegex)
    if (riderMatch) {
      const dorsal = parseInt(riderMatch[1], 10)
      const nome = riderMatch[2].trim()
      resultado.push({ nome, equipa: equipaAtual, dorsal, dnf: false, etapaAbandono: null })
      ultimoTipo = 'ciclista'
      continue
    }

    const teamMatch = linha.match(teamRegex)
    if (teamMatch) {
      const numeroEquipa = parseInt(teamMatch[1], 10)
      // Se o número de equipa não continuar a aumentar, é provavelmente
      // uma repetição do documento (ex: mesma lista noutra página) —
      // paramos para não misturar dados.
      if (ultimoNumeroEquipa > 0 && numeroEquipa <= ultimoNumeroEquipa) break
      ultimoNumeroEquipa = numeroEquipa
      equipaAtual = teamMatch[2].trim()
      ultimoTipo = 'equipa'
      continue
    }

    // Linha de continuação (nome de equipa, de ciclista, ou de staff DS
    // que quebrou para a linha seguinte). Staff é ignorado de propósito.
    if (ultimoTipo === 'equipa') {
      equipaAtual = `${equipaAtual} ${linha}`.trim()
    } else if (ultimoTipo === 'ciclista' && resultado.length > 0) {
      resultado[resultado.length - 1].nome = `${resultado[resultado.length - 1].nome} ${linha}`.trim()
    }
    // ultimoTipo === 'staff' (ou null): ignora a linha, não pertence a
    // nenhum ciclista/equipa.
  }

  return resultado
}

/** Primeira linha (posição 1) de uma classificação = líder dessa camisola. */
export function liderDaClassificacao(linhas: LinhaClassificacao[]): string | null {
  const primeiro = linhas.find(l => l.posicao === 1)
  return primeiro?.nome ?? null
}
