import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseClassificacao, parseStartlist, liderDaClassificacao } from '@/lib/pcsParser'
import { fetchClassificacaoTexto, fetchStartlistTexto, buildStageUrl, buildStartlistUrl } from '@/lib/pcsFetch'
import {
  notificarAberturaSeNecessario,
  notificarResultadosImportados,
  verificarLembretesApostas,
} from '@/lib/notificacoesGatilhos'

/**
 * Corre uma vez por dia (Vercel Cron, ver vercel.json — 17h UTC = 18h
 * de Portugal no horário de verão, quando decorrem as 3 Grandes
 * Voltas). Para cada prova ainda não finalizada:
 *  - atualiza a startlist (apanha desistências/DNF)
 *  - se estiver "fechada", vai buscar a etapa do dia (GC/Sprint/
 *    Montanha/Juventude) e grava os resultados
 *
 * Falhas ficam registadas por prova/etapa e no log global — não
 * interrompem as outras provas.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const secretQuery = new URL(req.url).searchParams.get('secret')
  const autorizado =
    !process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    secretQuery === process.env.CRON_SECRET
  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const hojeISO = new Date().toISOString().slice(0, 10)
  const detalhes: string[] = []
  let algumaFalha = false

  const { data: provas, error: provasError } = await supabase
    .from('provas')
    .select('id, nome, status, pcs_slug')
    .neq('status', 'finalizada')

  if (provasError) {
    await supabase.from('importacoes_log').insert({ sucesso: false, detalhes: provasError.message })
    return NextResponse.json({ error: provasError.message }, { status: 500 })
  }

  for (const prova of provas ?? []) {
    if (!prova.pcs_slug) {
      detalhes.push(`${prova.nome}: sem pcs_slug definido, saltada.`)
      continue
    }

    const ano = new Date().getFullYear()

    // 1) Startlist — sempre que a prova ainda não está finalizada
    try {
      const texto = await fetchStartlistTexto(buildStartlistUrl(prova.pcs_slug, ano))
      const linhas = parseStartlist(texto)
      if (linhas.length === 0) throw new Error('startlist vazia após processar')

      const registos = linhas.map(l => ({
        prova_id: prova.id,
        nome: l.nome,
        equipa: l.equipa || null,
        dorsal: l.dorsal,
        dnf: l.dnf,
        etapa_abandono: l.etapaAbandono,
        atualizado_em: new Date().toISOString(),
      }))
      await supabase.from('ciclistas_prova').upsert(registos, { onConflict: 'prova_id,nome' })
      await supabase
        .from('provas')
        .update({ startlist_sync_em: new Date().toISOString(), startlist_sync_status: 'sucesso' })
        .eq('id', prova.id)
      await notificarAberturaSeNecessario(supabase, prova.id)
      detalhes.push(`${prova.nome}: startlist ok (${registos.length} ciclistas).`)
    } catch (e) {
      algumaFalha = true
      const msg = e instanceof Error ? e.message : 'erro desconhecido'
      await supabase
        .from('provas')
        .update({ startlist_sync_em: new Date().toISOString(), startlist_sync_status: 'falha' })
        .eq('id', prova.id)
      detalhes.push(`${prova.nome}: falha na startlist (${msg}).`)
    }

    // 2) Resultados da etapa de hoje — só se a prova estiver "fechada"
    if (prova.status !== 'fechada') continue

    const { data: etapaHoje } = await supabase
      .from('etapas_planeadas')
      .select('numero_etapa, data_etapa')
      .eq('prova_id', prova.id)
      .eq('data_etapa', hojeISO)
      .maybeSingle()

    if (!etapaHoje) {
      detalhes.push(`${prova.nome}: sem etapa agendada para hoje.`)
      continue
    }

    const numero = etapaHoje.numero_etapa

    const { data: etapaAnterior } = await supabase
      .from('etapas_resultados')
      .select('import_status')
      .eq('prova_id', prova.id)
      .eq('numero_etapa', numero)
      .maybeSingle()

    try {
      const [geralTexto, sprintTexto, montanhaTexto, juventudeTexto] = await Promise.all([
        fetchClassificacaoTexto(buildStageUrl(prova.pcs_slug, ano, numero, 'gc')),
        fetchClassificacaoTexto(buildStageUrl(prova.pcs_slug, ano, numero, 'points')),
        fetchClassificacaoTexto(buildStageUrl(prova.pcs_slug, ano, numero, 'kom')),
        fetchClassificacaoTexto(buildStageUrl(prova.pcs_slug, ano, numero, 'youth')),
      ])

      const geral = parseClassificacao(geralTexto)
      if (geral.length === 0) throw new Error('classificação geral vazia após processar')

      const top20 = geral.slice(0, 20).map(l => l.nome)
      while (top20.length < 20) top20.push('')
      const tempos: Record<string, string> = {}
      geral.forEach(l => { if (l.tempo) tempos[l.nome] = l.tempo })

      const liderSprint = liderDaClassificacao(parseClassificacao(sprintTexto))
      const liderMontanha = liderDaClassificacao(parseClassificacao(montanhaTexto))
      const liderJuventude = liderDaClassificacao(parseClassificacao(juventudeTexto))

      await supabase.from('etapas_resultados').upsert(
        {
          prova_id: prova.id,
          numero_etapa: numero,
          classificacao_geral_top20: top20,
          classificacao_geral_completa: geral,
          tempos_classificacao: tempos,
          camisola_sprint: liderSprint,
          camisola_montanha: liderMontanha,
          camisola_juventude: liderJuventude,
          import_status: 'sucesso',
          import_erro: null,
          importado_em: new Date().toISOString(),
        },
        { onConflict: 'prova_id,numero_etapa' }
      )
      await notificarResultadosImportados(supabase, prova.nome, numero, etapaAnterior?.import_status)
      detalhes.push(`${prova.nome}: etapa ${numero} importada com sucesso.`)
    } catch (e) {
      algumaFalha = true
      const msg = e instanceof Error ? e.message : 'erro desconhecido'
      await supabase.from('etapas_resultados').upsert(
        { prova_id: prova.id, numero_etapa: numero, import_status: 'falha', import_erro: msg },
        { onConflict: 'prova_id,numero_etapa' }
      )
      detalhes.push(`${prova.nome}: falha a importar etapa ${numero} (${msg}).`)
    }
  }

  // Lembretes de "faltam N dias para fechar as apostas" — corre sempre,
  // independentemente de a importação da procyclingstats ter funcionado.
  try {
    await verificarLembretesApostas(supabase)
  } catch (e) {
    detalhes.push(`Lembretes de apostas: falha (${e instanceof Error ? e.message : 'erro desconhecido'}).`)
  }

  await supabase.from('importacoes_log').insert({ sucesso: !algumaFalha, detalhes: detalhes.join(' | ') })

  return NextResponse.json({ ok: true, algumaFalha, detalhes })
}
