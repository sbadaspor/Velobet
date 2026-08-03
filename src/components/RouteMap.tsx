'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type RoutePoint = { lat: number; lng: number; elevation?: number | null }

export type RouteMapData = {
  distancia_km: number | null
  elevacao_m: number | null
  perfil: string | null
  pontos: RoutePoint[] | null
}

type ProfileSegment = { x1: number; x2: number; y1: number; y2: number; slopeClass: number }

const SLOPE_COLORS = ['#4ade80', '#0ea5e9', '#facc15', '#fb923c', '#dc2626']
const SLOPE_LEGEND = ['0–2%', '2–4%', '4–6%', '6–8%', '8%+']
const CHART_W = 400

function slopeClassFor(pct: number) {
  if (pct < 2) return 0
  if (pct < 4) return 1
  if (pct < 6) return 2
  if (pct < 8) return 3
  return 4
}

/** Constrói a silhueta real da altimetria (um polígono preenchido por par de
 * pontos consecutivos), colorido segundo a inclinação local — em vez de
 * barras soltas, o topo de cada polígono segue a elevação real do ponto
 * seguinte, dando uma curva contínua (tipo perfil de montanha). */
function buildProfileSegments(pontos: RoutePoint[], distanciaKm: number, chartH: number) {
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

function ElevationChart({ segments, height }: { segments: ProfileSegment[]; height: number }) {
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

export default function RouteMap({ route, size }: { route: RouteMapData; size: 'compact' | 'large' }) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)

  const pontos = route.pontos ?? []
  const temRota = pontos.length >= 2

  useEffect(() => {
    if (!temRota || !mapRef.current) return

    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return

      const lats = pontos.map(p => p.lat)
      const lngs = pontos.map(p => p.lng)
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ]

      const map = L.map(mapRef.current, {
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
        attributionControl: false,
      }).fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

      L.polyline(pontos.map(p => [p.lat, p.lng]), {
        color: '#1877f2', weight: 3, opacity: 0.8, lineCap: 'round', lineJoin: 'round',
      }).addTo(map)

      L.circleMarker([pontos[0].lat, pontos[0].lng], {
        radius: 6, fillColor: '#4ade80', color: '#16a34a', weight: 2, opacity: 1, fillOpacity: 0.9,
      }).addTo(map)

      const last = pontos[pontos.length - 1]
      L.circleMarker([last.lat, last.lng], {
        radius: 6, fillColor: '#dc2626', color: '#991b1b', weight: 2, opacity: 1, fillOpacity: 0.9,
      }).addTo(map)

      mapInstanceRef.current = map
    })()

    return () => {
      cancelled = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temRota, JSON.stringify(pontos)])

  if (!temRota) return null

  const distancia = route.distancia_km ?? 0
  const isCompact = size === 'compact'
  const chartHeight = isCompact ? 80 : 130
  const { segments, maxSlope } = buildProfileSegments(pontos, distancia, chartHeight)

  return (
    <div className="card overflow-hidden p-0">
      <div style={{ height: isCompact ? 220 : 280 }} ref={mapRef} />

      {isCompact ? (
        <div className="flex flex-col gap-3 px-4 py-3 bg-surface-2 border-t border-border">
          <ElevationChart segments={segments} height={chartHeight} />
          <div className="flex gap-6">
            <div>
              <div className="eyebrow" style={{ fontSize: 9 }}>Distância</div>
              <div className="mono text-sm font-bold mt-0.5">{distancia.toFixed(1)} km</div>
            </div>
            <div>
              <div className="eyebrow" style={{ fontSize: 9 }}>Elevação</div>
              <div className="mono text-sm font-bold mt-0.5">+{(route.elevacao_m ?? 0).toFixed(0)} m</div>
            </div>
            {route.perfil && (
              <div>
                <div className="eyebrow" style={{ fontSize: 9 }}>Tipo</div>
                <div className="text-sm font-bold mt-0.5">{route.perfil}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-4 bg-surface-2 border-t border-border">
          <div className="flex gap-6">
            <div>
              <div className="eyebrow" style={{ fontSize: 9 }}>Distância</div>
              <div className="mono text-lg font-bold mt-0.5">{distancia.toFixed(1)} km</div>
            </div>
            <div>
              <div className="eyebrow" style={{ fontSize: 9 }}>Elevação</div>
              <div className="mono text-lg font-bold mt-0.5">+{(route.elevacao_m ?? 0).toFixed(0)} m</div>
            </div>
            <div>
              <div className="eyebrow" style={{ fontSize: 9 }}>Inclinação Máx.</div>
              <div className="mono text-lg font-bold mt-0.5">{maxSlope.toFixed(1)}%</div>
            </div>
          </div>

          <ElevationChart segments={segments} height={chartHeight} />

          <div className="flex gap-3 mono text-[10px] text-text-dim flex-wrap">
            {SLOPE_LEGEND.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[1px]" style={{ background: SLOPE_COLORS[i] }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
