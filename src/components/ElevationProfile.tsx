import type { RoutePoint } from './RouteMap'

export type ProfileSegment = { x1: number; x2: number; y1: number; y2: number; slopeClass: number }

export const SLOPE_COLORS = ['#4ade80', '#0ea5e9', '#facc15', '#fb923c', '#dc2626']
export const SLOPE_LEGEND = ['0–2%', '2–4%', '4–6%', '6–8%', '8%+']
export const CHART_W = 400

function slopeClassFor(pct: number) {
  if (pct < 2) return 0
  if (pct < 4) return 1
  if (pct < 6) return 2
  if (pct < 8) return 3
  return 4
}

/** Constrói a silhueta real da altimetria (um polígono preenchido por par de
 * pontos consecutivos), colorido segundo a inclinação local — o topo de
 * cada polígono segue a elevação real do ponto seguinte, dando uma curva
 * contínua (tipo perfil de montanha), em vez de barras soltas. */
export function buildProfileSegments(pontos: RoutePoint[], distanciaKm: number, chartH: number) {
  const elevations = pontos.map(p => p.elevation ?? 0)
  const n = elevations.length
  if (n < 2) return { segments: [] as ProfileSegment[], maxSlope: 0 }

  const minE = Math.min(...elevations)
  const maxE = Math.max(...elevations)
  const range = Math.max(1, maxE - minE)
  const segDistKm = distanciaKm / (n - 1)

  const segments: ProfileSegment[] = []
  let maxSlope = 0

  for (let i = 0; i < n - 1; i++) {
    const x1 = (i / (n - 1)) * CHART_W
    const x2 = ((i + 1) / (n - 1)) * CHART_W
    const y1 = chartH - ((elevations[i] - minE) / range) * chartH
    const y2 = chartH - ((elevations[i + 1] - minE) / range) * chartH

    const gain = Math.max(0, elevations[i + 1] - elevations[i])
    const slopePercent = segDistKm > 0 ? (gain / (segDistKm * 1000)) * 100 : 0
    maxSlope = Math.max(maxSlope, slopePercent)

    segments.push({ x1, x2, y1, y2, slopeClass: slopeClassFor(slopePercent) })
  }

  return { segments, maxSlope }
}

export function ElevationChart({ segments, height }: { segments: ProfileSegment[]; height: number }) {
  return (
    <svg viewBox={`0 0 ${CHART_W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {segments.map((s, i) => (
        <polygon
          key={i}
          points={`${s.x1},${height} ${s.x1},${s.y1} ${s.x2},${s.y2} ${s.x2},${height}`}
          fill={SLOPE_COLORS[s.slopeClass]}
        />
      ))}
    </svg>
  )
}

/** Perfil de elevação completo (gráfico + legenda), pronto a encaixar tanto
 * em fundo claro como no card-hero escuro — passa `dim` para usar as cores
 * "on-ink" do texto da legenda quando está sobre fundo escuro. */
export default function ElevationProfile({
  pontos, distanciaKm, height, showLegend, dim,
}: {
  pontos: RoutePoint[]
  distanciaKm: number
  height: number
  showLegend?: boolean
  dim?: boolean
}) {
  const { segments } = buildProfileSegments(pontos, distanciaKm, height)
  if (segments.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <ElevationChart segments={segments} height={height} />
      {showLegend && (
        <div className={`flex gap-3 mono text-[10px] flex-wrap ${dim ? 'text-on-ink-dim' : 'text-text-dim'}`}>
          {SLOPE_LEGEND.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-[1px]" style={{ background: SLOPE_COLORS[i] }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
