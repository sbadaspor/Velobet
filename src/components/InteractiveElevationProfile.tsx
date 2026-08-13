'use client'

import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RoutePoint } from './RouteMap'
import { buildProfileSegments, ElevationChart, SLOPE_COLORS } from './ElevationProfile'

function slopeClassFor(pctAbs: number) {
  if (pctAbs < 2) return 0
  if (pctAbs < 4) return 1
  if (pctAbs < 6) return 2
  if (pctAbs < 8) return 3
  return 4
}

/** Perfil de elevação com um marcador arrastável por cima — ao clicar/tocar
 * ou arrastar sobre o gráfico, mostra a distância percorrida, elevação e
 * inclinação (grade) nesse ponto exato do percurso. Não é GPS ao vivo (não
 * há posição real dos ciclistas) — é um "scrubber" visual sobre o percurso
 * já desenhado (`rota_pontos`), para explorar o perfil da etapa. */
export default function InteractiveElevationProfile({
  pontos, distanciaKm, height, dim,
}: {
  pontos: RoutePoint[]
  distanciaKm: number
  height: number
  dim?: boolean
}) {
  const { segments } = buildProfileSegments(pontos, distanciaKm, height)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fracao, setFracao] = useState(0) // posição do marcador, 0..1 ao longo do percurso
  const [arrastando, setArrastando] = useState(false)

  if (segments.length === 0 || pontos.length < 2) return null

  const n = pontos.length
  const elevations = pontos.map(p => p.elevation ?? 0)
  const segDistKm = distanciaKm / (n - 1)

  function atualizarFracaoPorX(clientX: number) {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return
    setFracao(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)))
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setArrastando(true)
    atualizarFracaoPorX(e.clientX)
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!arrastando) return
    atualizarFracaoPorX(e.clientX)
  }
  function pararDeArrastar() {
    setArrastando(false)
  }

  const index = Math.round(fracao * (n - 1))
  const distanciaAtual = fracao * distanciaKm
  const elevacaoAtual = elevations[index] ?? 0

  const proxIndex = Math.min(n - 1, index + 1)
  const gain = elevations[proxIndex] - elevations[index]
  const gradePercent = segDistKm > 0 && proxIndex !== index ? (gain / (segDistKm * 1000)) * 100 : 0
  const slopeClass = slopeClassFor(Math.abs(gradePercent))

  const labelClass = dim ? 'text-on-ink-dim' : 'text-text-dim'
  const valueClass = dim ? 'text-on-ink' : 'text-text'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-center gap-6 mb-1">
        <div className="flex flex-col items-center text-center">
          <div className={`eyebrow ${dim ? 'eyebrow-on-ink' : ''}`}>Distância</div>
          <div className={`stat-md mt-1 ${valueClass}`}>
            {distanciaAtual.toFixed(1)}
            <span className={`stat-unit ml-1 ${labelClass}`}>/{distanciaKm.toFixed(0)} km</span>
          </div>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className={`eyebrow ${dim ? 'eyebrow-on-ink' : ''}`}>Elevação</div>
          <div className={`stat-md mt-1 ${valueClass}`}>
            {Math.round(elevacaoAtual)}
            <span className={`stat-unit ml-1 ${labelClass}`}>m</span>
          </div>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className={`eyebrow ${dim ? 'eyebrow-on-ink' : ''}`}>Grade</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: SLOPE_COLORS[slopeClass] }} />
            <span className={`stat-md ${valueClass}`}>
              {gradePercent >= 0 ? '+' : ''}{gradePercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative touch-none select-none cursor-pointer"
        style={{ height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={pararDeArrastar}
        onPointerCancel={pararDeArrastar}
      >
        <ElevationChart segments={segments} height={height} />
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: `${fracao * 100}%`, width: 2, background: dim ? 'rgba(255,255,255,0.85)' : 'rgba(33,29,21,0.7)', transform: 'translateX(-1px)' }}
        />
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            left: `${fracao * 100}%`,
            top: -4,
            width: 10,
            height: 10,
            background: dim ? '#ffffff' : '#211D15',
            transform: 'translateX(-5px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
          }}
        />
      </div>
    </div>
  )
}
