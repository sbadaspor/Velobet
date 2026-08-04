import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const supabase = createAdminClient()

  const { data: provas, error } = await supabase
    .from('provas')
    .select(
      `id, nome, categoria, status, pcs_slug, data_inicio, data_fim, startlist_sync_em, startlist_sync_status,
       etapas_planeadas ( id, numero_etapa, nome, data_etapa, perfil, distancia_km, elevacao_m, local_partida, local_chegada, hora_inicio, rota_pontos ),
       etapas_resultados ( id, numero_etapa, classificacao_geral_top20, classificacao_geral_completa, camisola_sprint, camisola_montanha, camisola_juventude, sprint_completo, montanha_completo, juventude_completo, import_status, import_erro, importado_em )`
    )
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Contagens da startlist por prova (nº de ciclistas / nº de DNF)
  const provaIds = (provas ?? []).map(p => p.id)
  const contagens: Record<string, { count: number; dnf: number }> = {}
  if (provaIds.length > 0) {
    const { data: ciclistas } = await supabase
      .from('ciclistas_prova')
      .select('prova_id, dnf')
      .in('prova_id', provaIds)
    for (const c of ciclistas ?? []) {
      if (!contagens[c.prova_id]) contagens[c.prova_id] = { count: 0, dnf: 0 }
      contagens[c.prova_id].count++
      if (c.dnf) contagens[c.prova_id].dnf++
    }
  }

  const { data: ultimoLog } = await supabase
    .from('importacoes_log')
    .select('executado_em, sucesso, detalhes')
    .order('executado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  const resultado = (provas ?? []).map(p => ({
    ...p,
    // Não devolve o array bruto de rota_pontos (pode ser grande) — só uma flag.
    etapas_planeadas: (p.etapas_planeadas ?? []).map(e => {
      const { rota_pontos, ...resto } = e as typeof e & { rota_pontos: unknown[] | null }
      return { ...resto, tem_rota_pontos: Array.isArray(rota_pontos) && rota_pontos.length >= 2 }
    }),
    startlist: {
      count: contagens[p.id]?.count ?? 0,
      dnf: contagens[p.id]?.dnf ?? 0,
      lastSync: p.startlist_sync_em,
      lastSyncStatus: p.startlist_sync_status,
    },
  }))

  return NextResponse.json({ provas: resultado, ultimaImportacao: ultimoLog ?? null })
}

type EtapaInput = {
  numero_etapa: number | string
  nome?: string | null
  data_etapa?: string | null
  perfil?: string | null
  distancia_km?: number | string | null
  elevacao_m?: number | string | null
  local_partida?: string | null
  local_chegada?: string | null
  hora_inicio?: string | null
  rota_pontos_texto?: string | null
}

/** Faz parse do JSON de pontos da rota colado no admin. Devolve `undefined`
 * se o texto estiver vazio (não mexer no valor já guardado), ou lança erro
 * se o JSON for inválido. */
function parseRotaPontos(texto: string | null | undefined): unknown[] | undefined {
  if (!texto || !texto.trim()) return undefined
  const parsed = JSON.parse(texto)
  if (!Array.isArray(parsed) || parsed.some((p: unknown) => typeof (p as { lat?: unknown })?.lat !== 'number' || typeof (p as { lng?: unknown })?.lng !== 'number')) {
    throw new Error('formato inválido')
  }
  return parsed
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const body = await req.json()
  const { nome, categoria, status, pcs_slug, data_inicio, data_fim, etapas } = body as {
    nome: string
    categoria: string
    status: string
    pcs_slug?: string
    data_inicio: string
    data_fim: string
    etapas?: EtapaInput[]
  }

  if (!nome || !categoria || !status) {
    return NextResponse.json({ error: 'Nome, categoria e status são obrigatórios' }, { status: 400 })
  }
  if (!data_inicio || !data_fim) {
    return NextResponse.json({ error: 'Data de início e data de fim são obrigatórias' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: novaProva, error } = await supabase
    .from('provas')
    .insert({ nome, categoria, status, pcs_slug: pcs_slug || null, data_inicio, data_fim })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (etapas && etapas.length > 0) {
    let linhas: Record<string, unknown>[]
    try {
      linhas = etapas
        .filter(e => e.numero_etapa !== '' && e.numero_etapa != null)
        .map(e => {
          const rotaPontos = parseRotaPontos(e.rota_pontos_texto)
          return {
            prova_id: novaProva.id,
            numero_etapa: Number(e.numero_etapa),
            nome: e.nome || null,
            data_etapa: e.data_etapa || null,
            perfil: e.perfil || null,
            distancia_km: e.distancia_km !== '' && e.distancia_km != null ? Number(e.distancia_km) : null,
            elevacao_m: e.elevacao_m !== '' && e.elevacao_m != null ? Number(e.elevacao_m) : null,
            local_partida: e.local_partida || null,
            local_chegada: e.local_chegada || null,
            hora_inicio: e.hora_inicio || null,
            ...(rotaPontos !== undefined ? { rota_pontos: rotaPontos } : {}),
          }
        })
    } catch {
      return NextResponse.json({ error: 'Pontos da rota (JSON) inválidos numa das etapas.' }, { status: 400 })
    }
    if (linhas.length > 0) {
      const { error: etapasError } = await supabase.from('etapas_planeadas').insert(linhas)
      if (etapasError) return NextResponse.json({ error: etapasError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: novaProva.id })
}
