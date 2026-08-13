import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'

/** Lista, para uma prova, todos os jogadores (perfis) e a aposta que cada
 * um já tenha feito nessa prova (ou tudo a null/vazio se ainda não
 * apostou) — para o painel "Apostas dos Jogadores" no admin. */
export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const provaId = new URL(req.url).searchParams.get('provaId')
  if (!provaId) return NextResponse.json({ error: 'provaId é obrigatório' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: perfis, error: perfisError } = await supabase
    .from('perfis')
    .select('id, username, full_name, avatar_url')
    .order('username')

  if (perfisError) return NextResponse.json({ error: perfisError.message }, { status: 500 })

  const { data: apostas, error: apostasError } = await supabase
    .from('apostas')
    .select('user_id, apostas_top20, camisola_sprint, camisola_montanha, camisola_juventude')
    .eq('prova_id', provaId)

  if (apostasError) return NextResponse.json({ error: apostasError.message }, { status: 500 })

  const apostasPorUser = new Map((apostas ?? []).map(a => [a.user_id, a]))

  const jogadores = (perfis ?? []).map(p => {
    const aposta = apostasPorUser.get(p.id)
    return {
      user_id: p.id,
      username: p.username,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      apostas_top20: aposta?.apostas_top20 ?? null,
      camisola_sprint: aposta?.camisola_sprint ?? null,
      camisola_montanha: aposta?.camisola_montanha ?? null,
      camisola_juventude: aposta?.camisola_juventude ?? null,
    }
  })

  return NextResponse.json({ jogadores })
}

/** Cria ou substitui por completo a aposta de um jogador numa prova — o
 * admin pode consultar e corrigir qualquer aposta (ex: o jogador enganou-se
 * e já não há tempo de ele próprio corrigir, ou pediu para o admin ajustar
 * algo). Usa o cliente com service-role, por isso ignora as janelas de
 * fecho e outras regras do lado do jogador — o admin pode fazer o que for
 * preciso. */
export async function PUT(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const body = (await req.json()) as {
    provaId?: string
    userId?: string
    apostasTop20?: string[]
    camisolaSprint?: string
    camisolaMontanha?: string
    camisolaJuventude?: string
  }
  const { provaId, userId, apostasTop20, camisolaSprint, camisolaMontanha, camisolaJuventude } = body

  if (!provaId || !userId) {
    return NextResponse.json({ error: 'provaId e userId são obrigatórios' }, { status: 400 })
  }
  if (!Array.isArray(apostasTop20)) {
    return NextResponse.json({ error: 'apostasTop20 é obrigatório (lista de nomes)' }, { status: 400 })
  }

  const top20 = apostasTop20.slice(0, 20).map(n => (n ?? '').trim())
  while (top20.length < 20) top20.push('')

  const supabase = createAdminClient()
  const { error } = await supabase.from('apostas').upsert(
    {
      prova_id: provaId,
      user_id: userId,
      apostas_top20: top20,
      camisola_sprint: (camisolaSprint ?? '').trim(),
      camisola_montanha: (camisolaMontanha ?? '').trim(),
      camisola_juventude: (camisolaJuventude ?? '').trim(),
    },
    { onConflict: 'prova_id,user_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
