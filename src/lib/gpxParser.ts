/**
 * Conversão de um ficheiro GPX (exportado de Strava, Komoot,
 * RideWithGPS, etc.) para o formato de "pontos da rota" usado pelo
 * mapa/perfil de altimetria (coluna `rota_pontos` de
 * `etapas_planeadas`): `{ lat, lng, elevation? }[]`.
 *
 * Feito com regex simples em vez de um parser XML — o GPX é sempre
 * texto puro, e só nos interessam os `<trkpt>` (pontos de trajeto),
 * por isso não vale a pena adicionar uma dependência só para isto.
 * Corre inteiramente no browser (sem pedido ao servidor).
 */

export type PontoRota = { lat: number; lng: number; elevation?: number }

export function parseGpxParaPontosRota(gpxTexto: string): PontoRota[] {
  const pontos: PontoRota[] = []
  // Aceita <trkpt lat=".." lon=".."/> (auto-fechado) e
  // <trkpt lat=".." lon=".."> ... </trkpt> (com <ele>/<time> dentro).
  const trkptRegex = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/gi

  let match: RegExpExecArray | null
  while ((match = trkptRegex.exec(gpxTexto)) !== null) {
    const atributos = match[1]
    const conteudo = match[2] ?? ''

    const latMatch = atributos.match(/\blat=["']([-\d.]+)["']/i)
    const lonMatch = atributos.match(/\blon=["']([-\d.]+)["']/i)
    if (!latMatch || !lonMatch) continue

    const lat = parseFloat(latMatch[1])
    const lng = parseFloat(lonMatch[1])
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue

    const eleMatch = conteudo.match(/<ele>([-\d.]+)<\/ele>/i)
    const elevation = eleMatch ? parseFloat(eleMatch[1]) : undefined

    pontos.push(elevation !== undefined && !Number.isNaN(elevation) ? { lat, lng, elevation } : { lat, lng })
  }

  return pontos
}
