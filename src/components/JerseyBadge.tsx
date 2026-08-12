'use client'

import { useId } from 'react'

/**
 * Camisolas de líder (Sprint/Pontos, Montanha, Juventude) com cor real
 * por Grande Volta. Definido no design system a partir do componente
 * "Jersey — Camisolas" (Claude Design).
 */

export type JerseyTipo = 'sprint' | 'montanha' | 'juventude'
export type Race = 'giro' | 'tour' | 'vuelta' | 'outra'

export function detectRace(provaNome: string): Race {
  const n = (provaNome || '').toLowerCase()
  if (n.includes('giro')) return 'giro'
  if (n.includes('tour')) return 'tour'
  if (n.includes('vuelta')) return 'vuelta'
  return 'outra'
}

type Palette = { bg: string; dotColor?: string; border?: boolean }

const PALETTES: Record<Race, Record<JerseyTipo, Palette>> = {
  giro: {
    sprint: { bg: '#B0184B' }, // Maglia Ciclamino
    montanha: { bg: '#1E3A8A' }, // Maglia Azzurra
    juventude: { bg: '#FFFFFF', border: true }, // Maglia Bianca
  },
  tour: {
    sprint: { bg: '#4C9A2A' }, // Maillot Vert
    montanha: { bg: '#FFFFFF', dotColor: '#E4002B', border: true }, // Maillot à Pois
    juventude: { bg: '#FFFFFF', border: true }, // Maillot Blanc
  },
  vuelta: {
    sprint: { bg: '#00A651' }, // Maillot Verde
    montanha: { bg: '#FFFFFF', dotColor: '#1D4ED8', border: true }, // Bolinhas azuis
    juventude: { bg: '#FFFFFF', border: true }, // Maillot Blanco
  },
  outra: {
    sprint: { bg: 'var(--gold)' },
    montanha: { bg: 'var(--text-dim)' },
    juventude: { bg: '#FFFFFF', border: true },
  },
}

const LABELS: Record<Race, Record<JerseyTipo, string>> = {
  giro: { sprint: 'Sprint (Ciclamino)', montanha: 'Montanha (Azzurra)', juventude: 'Juventude (Bianca)' },
  tour: { sprint: 'Sprint (Vert)', montanha: 'Montanha (Pois)', juventude: 'Juventude (Blanc)' },
  vuelta: { sprint: 'Sprint (Verde)', montanha: 'Montanha (Bolinhas)', juventude: 'Juventude (Blanco)' },
  outra: { sprint: 'Sprint', montanha: 'Montanha', juventude: 'Juventude' },
}

/** Cor/padrão real da camisola, para usar fora deste componente (ex. ecrã Apostar). */
export function getJerseyPalette(provaNome: string, tipo: JerseyTipo): Palette {
  return PALETTES[detectRace(provaNome)][tipo]
}

export function getJerseyLabel(provaNome: string, tipo: JerseyTipo): string {
  return LABELS[detectRace(provaNome)][tipo]
}

export function JerseyCircle({ palette }: { palette: Palette }) {
  const patternId = useId()
  if (palette.dotColor) {
    return (
      <svg width={28} height={28} viewBox="0 0 28 28" className="flex-shrink-0">
        <defs>
          <pattern id={patternId} width={8} height={8} patternUnits="userSpaceOnUse">
            <circle cx={4} cy={4} r={1.6} fill={palette.dotColor} />
          </pattern>
        </defs>
        <circle cx={14} cy={14} r={13} fill="#FFFFFF" stroke="var(--border)" strokeWidth={1} />
        <circle cx={14} cy={14} r={13} fill={`url(#${patternId})`} />
      </svg>
    )
  }
  return (
    <div
      className="w-7 h-7 rounded-full flex-shrink-0"
      style={{ background: palette.bg, border: palette.border ? '1px solid var(--border)' : undefined }}
    />
  )
}

export default function JerseyBadge({
  tipo,
  rider,
  provaNome,
}: {
  tipo: JerseyTipo
  rider: string | null
  provaNome: string
}) {
  const race = detectRace(provaNome)
  const palette = PALETTES[race][tipo]
  const label = LABELS[race][tipo]
  return (
    <div
      className="flex flex-col items-center text-center px-3 py-3 rounded-md border border-border"
      style={{ background: 'var(--surface-3)' }}
    >
      <JerseyCircle palette={palette} />
      <div className="mono text-[9px] font-semibold uppercase tracking-wide text-text-dim mt-2 mb-1">{label}</div>
      <div className="text-xs font-semibold text-text truncate max-w-full">{rider || '—'}</div>
    </div>
  )
}
