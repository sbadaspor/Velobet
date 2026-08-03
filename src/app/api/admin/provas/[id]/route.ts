import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

type EtapaInput = {
  numero: number | string
  data?: string
  perfil?: string
  distancia?: number | string
  desnivel?: number | string
  local_partida?: string
  local_chegada?: string
  hora_inicio?: string
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { nome, categoria, status, pcs_slug, etapas } = body as {
    nome?: string
    categoria?: string
    status?: string
    pcs_slug?: string
    etapas?: EtapaInput[]
  }

  const supabase = createAdminClient()

  const camposProva: Record<string, unknown> = {}
  if (nome !== undefined) camposProva.nome = nome
  if (categoria !== undefined) camposProva.categoria = categoria
  if (status !== undefined) camposProva.status = status
  if (pcs_slug !== undefined) camposProva.pcs_slug = pcs_slug || null

  if (Object.keys(camposProva).length > 0) {
    const { error } = await supabase.from('provas').update(camposProva).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Atualiza etapas planeadas SEM apagar rota_pontos/elevacao_m já
  // importados — só atualiza os campos que vêm do formulário do admin,
  // e só cria etapas novas para números que ainda não existem.
  if (etapas && etapas.length > 0) {
    for (const e of etapas) {
      if (e.numero === '' || e.numero == null) continue
      const numero = Number(e.numero)

      const camposEtapa: Record<string, unknown> = {}
      if (e.data) camposEtapa.data_etapa = e.data
      if (e.perfil) camposEtapa.perfil = e.perfil
      if (e.distancia !== '' && e.distancia != null) camposEtapa.distancia_km = Number(e.distancia)
      if (e.desnivel !== '' && e.desnivel != null) camposEtapa.elevacao_m = Number(e.desnivel)
      if (e.local_partida) camposEtapa.local_partida = e.local_partida
      if (e.local_chegada) camposEtapa.local_chegada = e.local_chegada
      if (e.hora_inicio) camposEtapa.hora_inicio = e.hora_inicio

      const { data: existente } = await supabase
        .from('etapas_planeadas')
        .select('id')
        .eq('prova_id', id)
        .eq('numero_etapa', numero)
        .maybeSingle()

      if (existente) {
        if (Object.keys(camposEtapa).length > 0) {
          await supabase.from('etapas_planeadas').update(camposEtapa).eq('id', existente.id)
        }
      } else {
        await supabase.from('etapas_planeadas').insert({ prova_id: id, numero_etapa: numero, ...camposEtapa })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from('provas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
