'use client'

import { useRouter } from 'next/navigation'

type Regra = {
  main: string
  note?: string
  pts: string
  muted?: boolean
}

const REGRAS_GRANDE_VOLTA: Regra[] = [
  { main: 'Apostado no Top-10 → está no Top-10 real', pts: '3 pts' },
  { main: 'Apostado no 11-20 → está no 11-20 real', pts: '2 pts' },
  { main: 'Apostado no 11-20 → entrou no Top-10 real', note: 'Bónus por ter acertado mas o ciclista foi melhor', pts: '1 pt' },
  { main: 'Apostado no Top-10 → ficou no 11-20 real', note: 'Apostaste alto mas o ciclista ficou abaixo', pts: '0 pts', muted: true },
  { main: 'Cada camisola acertada', note: 'Sprint, Montanha, Juventude (3 pts máx)', pts: '1 pt' },
]

const REGRAS_MONUMENTO: Regra[] = [
  { main: 'Ciclista apostado está no Top-10 real', pts: '1 pt' },
  { main: 'Posição exata acertada', note: 'Total de 2 pts por posição exata', pts: '+1 pt' },
]

const DESEMPATE = [
  'Maior nº de posições exatas (total)',
  'Maior nº de posições exatas no Top-10',
  'Maior nº de posições exatas no Top-20',
  'Maior nº de camisolas acertadas',
]

const EXEMPLO: Regra[] = [
  { main: 'Pogačar ficou 1º → apostaste no Top-10 ✓', pts: '3 pts' },
  { main: 'Vingegaard ficou 3º → apostaste no Top-10 ✓', pts: '3 pts' },
  { main: 'Roglič ficou 12º → apostaste Top-10, ficou 11-20', pts: '0 pts', muted: true },
]

function StepBadge({ n }: { n: number }) {
  return (
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold text-gold-ink flex items-center justify-center mono text-base font-bold">
      {n}
    </div>
  )
}

function RuleRow({ regra, last }: { regra: Regra; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-3 ${last ? '' : 'border-b border-border'}`}>
      <div className="flex flex-col gap-1">
        <div className="text-sm">{regra.main}</div>
        {regra.note && <div className="text-xs text-text-sub italic">{regra.note}</div>}
      </div>
      <div className={`mono text-base font-bold flex-shrink-0 ${regra.muted ? 'text-text-sub' : 'text-text'}`}>{regra.pts}</div>
    </div>
  )
}

export default function RegrasPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 flex items-center gap-4 px-5 py-4 bg-surface border-b border-border">
        <button
          className="text-sm font-semibold text-text hover:text-gold-strong transition-colors"
          onClick={() => router.back()}
        >
          ← Voltar
        </button>
        <div className="flex-1 text-center text-sm font-semibold pr-14">Regras & Pontuação</div>
      </header>

      <div className="max-w-[560px] mx-auto px-5 py-6">
        <div className="eyebrow mb-3">Como funciona</div>
        <div className="display-2xl mb-2">Regras & Pontuação</div>
        <p className="text-sm text-text-dim mb-8 leading-relaxed">
          Antes de cada prova, aposta na classificação dos ciclistas. Quando os resultados saem, os teus pontos são calculados automaticamente.
        </p>

        {/* Como Apostar */}
        <div className="display-lg mb-3">Como Apostar</div>
        <div className="card mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-start">
              <StepBadge n={1} />
              <div>
                <div className="text-sm font-semibold">Escolhe uma prova</div>
                <div className="text-sm text-text-dim mt-0.5">Seleciona qualquer prova futura antes da data de início.</div>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <StepBadge n={2} />
              <div>
                <div className="text-sm font-semibold">Ordena os ciclistas</div>
                <div className="text-sm text-text-dim mt-0.5">Escolhe os ciclistas que achas que vão ficar no Top-20 (ou Top-10 nos monumentos), pela ordem que acreditas.</div>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <StepBadge n={3} />
              <div>
                <div className="text-sm font-semibold">Confirma a aposta</div>
                <div className="text-sm text-text-dim mt-0.5">Podes editar até à prova começar. Depois disso, fica bloqueada.</div>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <StepBadge n={4} />
              <div>
                <div className="text-sm font-semibold">Acompanha ao vivo</div>
                <div className="text-sm text-text-dim mt-0.5">Após cada etapa, os pontos são atualizados automaticamente.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Grande Volta & Prova da Semana */}
        <div className="display-lg mb-1">Grande Volta & Prova da Semana</div>
        <p className="text-sm text-text-dim mb-3">Apostas no Top-20 da classificação geral. Inclui camisolas especiais.</p>
        <div className="card mb-8">
          {REGRAS_GRANDE_VOLTA.map((r, i) => (
            <RuleRow key={r.main} regra={r} last={i === REGRAS_GRANDE_VOLTA.length - 1} />
          ))}
        </div>

        {/* Monumento & Prova de um dia */}
        <div className="display-lg mb-1">Monumento & Prova de um dia</div>
        <p className="text-sm text-text-dim mb-3">Apostas no Top-10 do resultado final. Sem camisolas.</p>
        <div className="card mb-8">
          {REGRAS_MONUMENTO.map((r, i) => (
            <RuleRow key={r.main} regra={r} last={i === REGRAS_MONUMENTO.length - 1} />
          ))}
        </div>

        {/* Critérios de Desempate */}
        <div className="display-lg mb-1">Critérios de Desempate</div>
        <p className="text-sm text-text-dim mb-3">Em caso de empate em pontos, o ranking usa estes critérios por ordem:</p>
        <div className="card mb-8">
          <div className="flex flex-col gap-3">
            {DESEMPATE.map((item, i) => (
              <div key={item} className="flex gap-3 items-start text-sm leading-relaxed">
                <span className="mono font-bold flex-shrink-0">{i + 1}.</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exemplo Prático */}
        <div className="display-lg mb-1">Exemplo Prático</div>
        <p className="text-sm text-text-dim mb-3">Apostaste Pogačar em 1º, Vingegaard em 2º, e Roglič em 5º numa Grande Volta.</p>
        <div className="card">
          {EXEMPLO.map(r => (
            <RuleRow key={r.main} regra={r} />
          ))}
          <div className="flex items-center justify-between pt-4 mt-1 border-t-2 border-border">
            <div className="text-sm font-semibold">Total (só estes 3)</div>
            <div className="mono text-lg font-bold text-gold-strong">6 pts</div>
          </div>
        </div>
      </div>
    </div>
  )
}
