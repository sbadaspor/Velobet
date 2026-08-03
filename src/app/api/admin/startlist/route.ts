import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseStartlist } from '@/lib/pcsParser'

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { provaId, texto } = (await req.json()) as { provaId: string; texto: string }
  if (!provaId || !texto?.trim()) {
    return NextResponse.json({ error: 'provaId e texto são obrigatórios' }, { status: 400 })
  }

  const linhas = parseStartlist(texto)
  if (linhas.length === 0) {
    return NextResponse.json(
      { error: 'Não consegui identificar nenhum ciclista neste texto. Confirma que colaste a startlist completa.' },
      { status: 422 }
    )
  }

  const supabase = createAdminClient()

  const registos = linhas.map(l => ({
    prova_id: provaId,
    nome: l.nome,
    equipa: l.equipa || null,
    dorsal: l.dorsal,
    dnf: l.dnf,
    etapa_abandono: l.etapaAbandono,
    atualizado_em: new Date().toISOString(),
  }))

  const { error } = await supabase.from('ciclistas_prova').upsert(registos, { onConflict: 'prova_id,nome' })

  const agora = new Date().toISOString()
  await supabase
    .from('provas')
    .update({ startlist_sync_em: agora, startlist_sync_status: error ? 'falha' : 'sucesso' })
    .eq('id', provaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, total: registos.length, dnf: registos.filter(r => r.dnf).length })
}
