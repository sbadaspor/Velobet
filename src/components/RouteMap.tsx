'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ElevationProfile from './ElevationProfile'

export type RoutePoint = { lat: number; lng: number; elevation?: number | null }

export type RouteMapData = {
  distancia_km: number | null
  elevacao_m: number | null
  perfil: string | null
  pontos: RoutePoint[] | null
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

  return (
    <div className="card overflow-hidden p-0">
      <div style={{ height: isCompact ? 220 : 280 }} ref={mapRef} />

      <div className={`flex flex-col gap-3 bg-surface-2 border-t border-border ${isCompact ? 'px-4 py-3' : 'px-4 py-4'}`}>
        <ElevationProfile pontos={pontos} distanciaKm={distancia} height={chartHeight} showLegend={!isCompact} />

        <div className="flex gap-6">
          <div>
            <div className="eyebrow" style={{ fontSize: 9 }}>Distância</div>
            <div className={`mono font-bold mt-0.5 ${isCompact ? 'text-sm' : 'text-lg'}`}>{distancia.toFixed(1)} km</div>
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9 }}>Elevação</div>
            <div className={`mono font-bold mt-0.5 ${isCompact ? 'text-sm' : 'text-lg'}`}>+{(route.elevacao_m ?? 0).toFixed(0)} m</div>
          </div>
          {route.perfil && (
            <div>
              <div className="eyebrow" style={{ fontSize: 9 }}>Tipo</div>
              <div className={`font-bold mt-0.5 ${isCompact ? 'text-sm' : 'text-lg'}`}>{route.perfil}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
