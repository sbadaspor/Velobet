import * as cheerio from 'cheerio'

/**
 * Vai buscar uma página do procyclingstats e devolve-a como texto,
 * "linha a linha", no mesmo formato que os campos de colar-e-processar
 * esperam — para reaproveitar exatamente o mesmo parser (pcsParser.ts)
 * tanto na importação automática como na manual.
 *
 * NOTA: o procyclingstats não tem API oficial gratuita. Isto lê o HTML
 * público da página. Se a estrutura da página mudar, esta função pode
 * deixar de encontrar a tabela certa — nesse caso o "colar e processar"
 * manual continua a funcionar como reserva.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`procyclingstats devolveu ${res.status} para ${url}`)
  }
  return res.text()
}

/** Extrai uma tabela de classificação (Rnk/Rider/Team/Time) como texto tab-separated. */
export async function fetchClassificacaoTexto(url: string): Promise<string> {
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  // A tabela de resultados do procyclingstats normalmente tem a classe "results".
  let tabela = $('table.results').first()
  if (tabela.length === 0) tabela = $('table').first()

  const linhas: string[] = []
  tabela.find('tr').each((_i: number, tr: unknown) => {
    const celulas = $(tr as never)
      .find('td, th')
      .map((_j: number, td: unknown) => $(td as never).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean)
    if (celulas.length > 0) linhas.push(celulas.join('\t'))
  })

  if (linhas.length === 0) {
    throw new Error('Não encontrei nenhuma tabela de resultados nesta página.')
  }
  return linhas.join('\n')
}

/** Extrai a startlist (agrupada por equipa) como texto linha a linha. */
export async function fetchStartlistTexto(url: string): Promise<string> {
  const html = await fetchHtml(url)
  // Insere quebras de linha depois de blocos de equipa/ciclista antes de
  // remover as tags, para preservar a separação por linha.
  const comQuebras = html.replace(/<\/(li|div|tr|p|h[1-6])>/gi, '</$1>\n')
  const $ = cheerio.load(comQuebras)
  $('script, style').remove()
  const texto: string = $('body').text()
  return texto
    .split('\n')
    .map((l: string) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

export function buildStageUrl(slug: string, year: number, stageNum: number, tipo: 'gc' | 'points' | 'kom' | 'youth') {
  return `https://www.procyclingstats.com/race/${slug}/${year}/stage-${stageNum}-${tipo}`
}

export function buildStartlistUrl(slug: string, year: number) {
  return `https://www.procyclingstats.com/race/${slug}/${year}/startlist`
}
