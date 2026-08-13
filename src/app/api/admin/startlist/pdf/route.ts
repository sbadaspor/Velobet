import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parsePdfStartlistTexto } from '@/lib/pcsParser'
import { notificarAberturaSeNecessario } from '@/lib/notificacoesGatilhos'

// Importa o ficheiro interno da lib (não o "pdf-parse" principal) —
// o index.js do pacote corre código de debug (tenta ler um PDF de
// teste que não existe no nosso projeto) quando é carregado num
// bundler como o Next.js. Ver src/types/pdf-parse-lib.d.ts.
async function extrairTextoPdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  const dados = await pdfParse(buffer)
  return dados.text
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const form = await req.formData()
  const provaId = form.get('provaId')
  const arquivo = form.get('arquivo')

  if (typeof provaId !== 'string' || !provaId) {
    return NextResponse.json({ error: 'provaId é obrigatório' }, { status: 400 })
  }
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'Ficheiro PDF em falta' }, { status: 400 })
  }
  if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'O ficheiro tem de ser um PDF.' }, { status: 400 })
  }

  let textoExtraido: string
  try {
    const buffer = Buffer.from(await arquivo.arrayBuffer())
    textoExtraido = await extrairTextoPdf(buffer)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro desconhecido'
    return NextResponse.json({ error: `Não consegui ler o PDF (${msg}).` }, { status: 422 })
  }

  const linhas = parsePdfStartlistTexto(textoExtraido)
  if (linhas.length === 0) {
    return NextResponse.json(
      { error: 'Não consegui identificar nenhum ciclista neste PDF. Confirma que é o PDF de startlist descarregado do procyclingstats.' },
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

  await notificarAberturaSeNecessario(supabase, provaId)

  return NextResponse.json({ ok: true, total: registos.length, dnf: registos.filter(r => r.dnf).length })
}
