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
       etapas_planeadas ( id, numero_etapa, data_etapa, perfil, distancia_km, elevacao_m, local_partida, local_chegada, hora_inicio ),
       etapas_resultados ( id, numero_etapa, classificacao_geral_top20, camisola_sprint, camisola_montanha, camisola_juventude, import_status, import_erro, importado_em )`
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
  data_etapa?: string | null
  perfil?: string | null
  distancia_km?: number | string | null
  elevacao_m?: number | string | null
  local_partida?: string | null
  local_chegada?: string | null
  hora_inicio?: string | null
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
    const linhas = etapas
      .filter(e => e.numero_etapa !== '' && e.numero_etapa != null)
      .map(e => ({
        prova_id: novaProva.id,
        numero_etapa: Number(e.numero_etapa),
        data_etapa: e.data_etapa || null,
        perfil: e.perfil || null,
        distancia_km: e.distancia_km !== '' && e.distancia_km != null ? Number(e.distancia_km) : null,
        elevacao_m: e.elevacao_m !== '' && e.elevacao_m != null ? Number(e.elevacao_m) : null,
        local_partida: e.local_partida || null,
        local_chegada: e.local_chegada || null,
        hora_inicio: e.hora_inicio || null,
      }))
    if (linhas.length > 0) {
      const { error: etapasError } = await supabase.from('etapas_planeadas').insert(linhas)
      if (etapasError) return NextResponse.json({ error: etapasError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: novaProva.id })
}
