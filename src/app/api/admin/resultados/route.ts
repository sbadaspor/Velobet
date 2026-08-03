import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseClassificacao, liderDaClassificacao } from '@/lib/pcsParser'

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const body = (await req.json()) as {
    provaId: string
    numeroEtapa: number | string
    classificacao?: string
    sprint?: string
    montanha?: string
    juventude?: string
  }

  const { provaId, numeroEtapa, classificacao, sprint, montanha, juventude } = body
  if (!provaId || numeroEtapa === undefined || numeroEtapa === null) {
    return NextResponse.json({ error: 'provaId e numeroEtapa são obrigatórios' }, { status: 400 })
  }
  if (!classificacao?.trim() && !sprint?.trim() && !montanha?.trim() && !juventude?.trim()) {
    return NextResponse.json({ error: 'Cola pelo menos um dos 4 textos.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const dados: Record<string, unknown> = {
    prova_id: provaId,
    numero_etapa: Number(numeroEtapa),
  }

  try {
    if (classificacao?.trim()) {
      const geral = parseClassificacao(classificacao)
      if (geral.length === 0) {
        return NextResponse.json({ error: 'Não consegui ler nenhuma linha na Classificação Geral colada.' }, { status: 422 })
      }
      const top20 = geral.slice(0, 20).map(l => l.nome)
      while (top20.length < 20) top20.push('')
      const tempos: Record<string, string> = {}
      geral.forEach(l => { if (l.tempo) tempos[l.nome] = l.tempo })

      dados.classificacao_geral_top20 = top20
      dados.classificacao_geral_completa = geral
      dados.tempos_classificacao = tempos
    }

    if (sprint?.trim()) {
      const linhas = parseClassificacao(sprint)
      const lider = liderDaClassificacao(linhas)
      if (!lider) return NextResponse.json({ error: 'Não consegui identificar o líder do Sprint no texto colado.' }, { status: 422 })
      dados.camisola_sprint = lider
    }
    if (montanha?.trim()) {
      const linhas = parseClassificacao(montanha)
      const lider = liderDaClassificacao(linhas)
      if (!lider) return NextResponse.json({ error: 'Não consegui identificar o líder da Montanha no texto colado.' }, { status: 422 })
      dados.camisola_montanha = lider
    }
    if (juventude?.trim()) {
      const linhas = parseClassificacao(juventude)
      const lider = liderDaClassificacao(linhas)
      if (!lider) return NextResponse.json({ error: 'Não consegui identificar o líder da Juventude no texto colado.' }, { status: 422 })
      dados.camisola_juventude = lider
    }
  } catch {
    return NextResponse.json({ error: 'Erro a processar o texto colado. Confirma o formato.' }, { status: 422 })
  }

  dados.import_status = 'sucesso'
  dados.import_erro = null
  dados.importado_em = new Date().toISOString()

  const { error } = await supabase
    .from('etapas_resultados')
    .upsert(dados, { onConflict: 'prova_id,numero_etapa' })

  if (error) {
    // Regista a falha na própria etapa para aparecer no admin
    await supabase
      .from('etapas_resultados')
      .upsert(
        { prova_id: provaId, numero_etapa: Number(numeroEtapa), import_status: 'falha', import_erro: error.message },
        { onConflict: 'prova_id,numero_etapa' }
      )
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
