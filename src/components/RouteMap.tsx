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

type SlopeBar = { slopeClass: number; height: number }

const SLOPE_COLORS = ['#4ade80', '#0ea5e9', '#facc15', '#fb923c', '#dc2626']
const SLOPE_LEGEND = ['0–2%', '2–4%', '4–6%', '6–8%', '8%+']

function slopeClassFor(pct: number) {
  if (pct < 2) return 0
  if (pct < 4) return 1
  if (pct < 6) return 2
  if (pct < 8) return 3
  return 4
}

/** Divide os pontos da rota em N segmentos e calcula a inclinação média de
 * cada um, para colorir as barras do perfil de elevação (mesma lógica do
 * handoff do Claude Design). */
function buildSlopeBars(pontos: RoutePoint[], distanciaKm: number, segmentCount: number, maxHeight: number) {
  const elevations = pontos.map(p => p.elevation ?? 0)
  if (elevations.length < 2) return { bars: [] as SlopeBar[], maxSlope: 0 }

  const segmentSize = Math.ceil(elevations.length / segmentCount)
  const bars: SlopeBar[] = []
  let maxSlope = 0

  for (let i = 0; i < segmentCount; i++) {
    const startIdx = i * segmentSize
    const endIdx = Math.min((i + 1) * segmentSize, elevations.length - 1)
    if (startIdx >= elevations.length - 1) continue

    const startElev = elevations[startIdx]
    const endElev = elevations[endIdx]
    const segmentDist = (distanciaKm * (endIdx - startIdx)) / elevations.length
    const elevGain = Math.max(0, endElev - startElev)
    const slopePercent = segmentDist > 0 ? (elevGain / (segmentDist * 1000)) * 100 : 0
    maxSlope = Math.max(maxSlope, slopePercent)

    bars.push({ slopeClass: slopeClassFor(slopePercent), height: Math.max(4, (slopePercent / 12) * maxHeight) })
  }

  return { bars, maxSlope }
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
  const { bars, maxSlope } = buildSlopeBars(pontos, distancia, 20, isCompact ? 60 : 100)

  return (
    <div className="card overflow-hidden p-0">
      <div style={{ height: isCompact ? 180 : 240 }} ref={mapRef} />

      {isCompact ? (
        <div className="flex flex-col gap-3 px-4 py-3 bg-surface-2 border-t border-border">
          <div className="flex items-end gap-[1px]" style={{ height: 60 }}>
            {bars.map((bar, i) => (
              <div key={i} className="flex-1 rounded-[1px]" style={{ height: bar.height, background: SLOPE_COLORS[bar.slopeClass], minHeight: 2 }} />
            ))}
          </div>
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

          <div className="flex items-end gap-[1px]" style={{ height: 100 }}>
            {bars.map((bar, i) => (
              <div key={i} className="flex-1 rounded-[1px]" style={{ height: bar.height, background: SLOPE_COLORS[bar.slopeClass], minHeight: 2 }} />
            ))}
          </div>

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
