import type { SupabaseClient } from '@supabase/supabase-js'
import { enviarNotificacaoPush } from '@/lib/webPush'

type Aposta = {
  user_id: string
  apostas_top20: string[] | null
  camisola_sprint: string | null
  camisola_montanha: string | null
  camisola_juventude: string | null
}

function apostaCompleta(a: Aposta): boolean {
  const top20ok =
    Array.isArray(a.apostas_top20) &&
    a.apostas_top20.length === 20 &&
    a.apostas_top20.every((nome) => !!nome && nome.trim() !== '')
  return top20ok && !!a.camisola_sprint && !!a.camisola_montanha && !!a.camisola_juventude
}

/**
 * Gatilho 1 — "prova abre para apostas". Chamar depois de qualquer ação de
 * admin que possa mudar o estado "aberta + tem startlist" de uma prova
 * (mudar status, colar/carregar startlist). Só notifica uma vez por prova
 * (guardado em `provas.notificacao_abertura_enviada`) — é seguro chamar
 * repetidamente.
 */
export async function notificarAberturaSeNecessario(supabase: SupabaseClient, provaId: string) {
  const { data: prova } = await supabase
    .from('provas')
    .select('id, nome, status, notificacao_abertura_enviada')
    .eq('id', provaId)
    .maybeSingle()

  if (!prova || prova.status !== 'aberta' || prova.notificacao_abertura_enviada) return

  const { count } = await supabase
    .from('ciclistas_prova')
    .select('*', { count: 'exact', head: true })
    .eq('prova_id', provaId)

  if (!count || count === 0) return

  const { data: perfis } = await supabase.from('perfis').select('id')
  const userIds = (perfis ?? []).map((p) => p.id as string)

  await enviarNotificacaoPush(
    userIds,
    {
      title: 'Já podes apostar!',
      body: `${prova.nome} está aberta para apostas.`,
      url: '/proximas',
    },
    supabase
  )

  await supabase.from('provas').update({ notificacao_abertura_enviada: true }).eq('id', provaId)
}

/**
 * Gatilho 2 — "resultados de etapa importados". Chamar depois de gravar
 * resultados de uma etapa com sucesso. `importStatusAnterior` é o
 * `import_status` que a linha tinha ANTES deste upsert (ou null/undefined
 * se não existia) — só notifica se antes NÃO estava já 'sucesso', para uma
 * correção/re-colagem da mesma etapa não voltar a notificar toda a gente.
 */
export async function notificarResultadosImportados(
  supabase: SupabaseClient,
  provaNome: string,
  numeroEtapa: number,
  importStatusAnterior: string | null | undefined
) {
  if (importStatusAnterior === 'sucesso') return

  const { data: perfis } = await supabase.from('perfis').select('id')
  const userIds = (perfis ?? []).map((p) => p.id as string)

  await enviarNotificacaoPush(
    userIds,
    {
      title: 'Resultados atualizados',
      body: `Etapa ${numeroEtapa} de ${provaNome} já tem resultados — vê os teus pontos.`,
      url: '/classificacao',
    },
    supabase
  )
}

/**
 * Gatilho 3 — lembretes de 3/2/1 dias antes de fecharem as apostas
 * (hora da 1ª etapa, já convertida para hora de Portugal pela view
 * `provas_janela_apostas`), só a quem ainda não completou a aposta.
 * Chamado uma vez por dia a partir do cron existente.
 */
export async function verificarLembretesApostas(supabase: SupabaseClient) {
  const { data: provas } = await supabase
    .from('provas_janela_apostas')
    .select('prova_id, nome, horas_ate_fechar')

  for (const prova of provas ?? []) {
    const horas = prova.horas_ate_fechar as number | null
    if (horas == null) continue

    for (const diasAntes of [3, 2, 1]) {
      const alvo = diasAntes * 24
      // janela de ±12h à volta do alvo — o cron só corre 1x/dia, isto
      // garante que cada alvo é apanhado exatamente uma vez.
      if (horas > alvo + 12 || horas <= alvo - 12) continue

      const { data: jaEnviado } = await supabase
        .from('lembretes_enviados')
        .select('prova_id')
        .eq('prova_id', prova.prova_id)
        .eq('dias_antes', diasAntes)
        .maybeSingle()
      if (jaEnviado) continue

      const [{ data: perfis }, { data: apostas }] = await Promise.all([
        supabase.from('perfis').select('id'),
        supabase
          .from('apostas')
          .select('user_id, apostas_top20, camisola_sprint, camisola_montanha, camisola_juventude')
          .eq('prova_id', prova.prova_id),
      ])

      const completos = new Set(
        ((apostas ?? []) as Aposta[]).filter(apostaCompleta).map((a) => a.user_id)
      )
      const faltam = ((perfis ?? []) as { id: string }[])
        .map((p) => p.id)
        .filter((id) => !completos.has(id))

      if (faltam.length > 0) {
        await enviarNotificacaoPush(
          faltam,
          {
            title: `Faltam ${diasAntes} dia${diasAntes > 1 ? 's' : ''} para fechar as apostas`,
            body: `Ainda não apostaste em ${prova.nome}.`,
            url: `/apostar/${prova.prova_id}`,
          },
          supabase
        )
      }

      await supabase.from('lembretes_enviados').insert({ prova_id: prova.prova_id, dias_antes: diasAntes })
    }
  }
}
