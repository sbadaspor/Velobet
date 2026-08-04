'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

type EtapaPlaneada = {
  id?: string
  numero_etapa: number | string
  nome: string | null
  data_etapa: string | null
  perfil: string | null
  distancia_km: number | string | null
  elevacao_m: number | string | null
  local_partida: string | null
  local_chegada: string | null
  hora_inicio: string | null
  tem_rota_pontos?: boolean
  rota_pontos_texto?: string
}

type LinhaClassificacao = {
  posicao: number
  nome: string
  equipa: string
  tempo: string
}

type EtapaResultado = {
  id: string
  numero_etapa: number
  classificacao_geral_top20: string[] | null
  classificacao_geral_completa: LinhaClassificacao[] | null
  camisola_sprint: string | null
  camisola_montanha: string | null
  camisola_juventude: string | null
  sprint_completo: LinhaClassificacao[] | null
  montanha_completo: LinhaClassificacao[] | null
  juventude_completo: LinhaClassificacao[] | null
  import_status: 'pendente' | 'sucesso' | 'falha' | null
  import_erro: string | null
  importado_em: string | null
}

type Prova = {
  id: string
  nome: string
  categoria: string
  status: string
  pcs_slug: string | null
  data_inicio: string | null
  data_fim: string | null
  startlist_sync_em: string | null
  startlist_sync_status: string | null
  etapas_planeadas: EtapaPlaneada[]
  etapas_resultados: EtapaResultado[]
  startlist: { count: number; dnf: number; lastSync: string | null; lastSyncStatus: string | null }
}

type UltimaImportacao = { executado_em: string; sucesso: boolean; detalhes: string | null } | null

const CATEGORIAS = ['grande_volta', 'prova_semana', 'monumento', 'prova_dia']
const STATUSES = ['aberta', 'fechada', 'finalizada']

function statusBadgeStyle(status: string) {
  if (status === 'aberta') return { background: 'rgba(22,163,74,0.14)', color: '#146633' }
  if (status === 'fechada') return { background: 'rgba(184,134,11,0.14)', color: '#734C06' }
  return { background: 'rgba(107,114,128,0.14)', color: '#4B5563' }
}

function importBadge(status: string | null) {
  if (status === 'sucesso') return { label: 'Importada', color: '#146633', bg: 'rgba(22,163,74,0.14)' }
  if (status === 'falha') return { label: 'Falha', color: 'var(--red)', bg: 'rgba(208,69,42,0.14)' }
  return { label: 'Pendente', color: 'var(--text-dim)', bg: 'var(--surface-3)' }
}

const emptyEtapa = (): EtapaPlaneada => ({
  numero_etapa: '',
  nome: '',
  data_etapa: '',
  perfil: '',
  distancia_km: '',
  elevacao_m: '',
  local_partida: '',
  local_chegada: '',
  hora_inicio: '',
  rota_pontos_texto: '',
})

export default function AdminClient() {
  const [loading, setLoading] = useState(true)
  const [provas, setProvas] = useState<Prova[]>([])
  const [ultimaImportacao, setUltimaImportacao] = useState<UltimaImportacao>(null)
  const [activeTab, setActiveTab] = useState<'provas' | 'etapas'>('provas')
  const [selectedProvaId, setSelectedProvaId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const [showProvaModal, setShowProvaModal] = useState(false)
  const [editingProva, setEditingProva] = useState<{
    id?: string
    nome: string
    categoria: string
    status: string
    pcs_slug: string
    data_inicio: string
    data_fim: string
    etapas: EtapaPlaneada[]
  } | null>(null)

  const [showResultsModal, setShowResultsModal] = useState(false)
  const [editingEtapaNumero, setEditingEtapaNumero] = useState<number | null>(null)
  const [resultsForm, setResultsForm] = useState({ classificacao: '', sprint: '', montanha: '', juventude: '' })
  const [savingResults, setSavingResults] = useState(false)

  const [startlistPaste, setStartlistPaste] = useState('')
  const [savingStartlist, setSavingStartlist] = useState(false)
  const [savingStartlistPdf, setSavingStartlistPdf] = useState(false)
  const [apagandoStartlist, setApagandoStartlist] = useState(false)

  const [etapasAbertas, setEtapasAbertas] = useState<Set<number>>(new Set())
  const [rankingModal, setRankingModal] = useState<{ titulo: string; linhas: LinhaClassificacao[] } | null>(null)

  function alternarEtapaAberta(numero: number) {
    setEtapasAbertas(anterior => {
      const novo = new Set(anterior)
      if (novo.has(numero)) novo.delete(numero)
      else novo.add(numero)
      return novo
    })
  }

  function abrirRanking(titulo: string, linhas: LinhaClassificacao[] | null) {
    if (!linhas || linhas.length === 0) return
    setRankingModal({ titulo, linhas: [...linhas].sort((a, b) => a.posicao - b.posicao) })
  }

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/admin/provas')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar')
      setProvas(json.provas)
      setUltimaImportacao(json.ultimaImportacao)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const selectedProva = provas.find(p => p.id === selectedProvaId) ?? null

  function abrirCriarProva() {
    setEditingProva({ nome: '', categoria: '', status: 'aberta', pcs_slug: '', data_inicio: '', data_fim: '', etapas: [emptyEtapa()] })
    setShowProvaModal(true)
  }

  function abrirEditarProva(p: Prova) {
    setEditingProva({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      status: p.status,
      pcs_slug: p.pcs_slug ?? '',
      data_inicio: p.data_inicio ?? '',
      data_fim: p.data_fim ?? '',
      etapas:
        p.etapas_planeadas.length > 0
          ? p.etapas_planeadas
              .slice()
              .sort((a, b) => Number(a.numero_etapa) - Number(b.numero_etapa))
              .map(e => ({ ...e, rota_pontos_texto: '' }))
          : [emptyEtapa()],
    })
    setShowProvaModal(true)
  }

  async function guardarProva() {
    if (!editingProva) return
    if (!editingProva.data_inicio || !editingProva.data_fim) {
      alert('Data de início e data de fim são obrigatórias.')
      return
    }
    for (let i = 0; i < editingProva.etapas.length; i++) {
      const texto = editingProva.etapas[i].rota_pontos_texto
      if (texto && texto.trim()) {
        try {
          const parsed = JSON.parse(texto)
          if (!Array.isArray(parsed) || parsed.some(p => typeof p.lat !== 'number' || typeof p.lng !== 'number')) {
            throw new Error('formato inválido')
          }
        } catch {
          alert(`Etapa ${i + 1}: os "Pontos da Rota" não são um JSON válido. Deve ser uma lista como [{"lat":41.9,"lng":12.5}, ...].`)
          return
        }
      }
    }
    const payload = {
      nome: editingProva.nome,
      categoria: editingProva.categoria,
      status: editingProva.status,
      pcs_slug: editingProva.pcs_slug,
      data_inicio: editingProva.data_inicio,
      data_fim: editingProva.data_fim,
      etapas: editingProva.etapas,
    }
    const url = editingProva.id ? `/api/admin/provas/${editingProva.id}` : '/api/admin/provas'
    const method = editingProva.id ? 'PUT' : 'POST'
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) {
        alert('Erro a guardar: ' + json.error)
        return
      }
      const provaId = editingProva.id ?? json.id
      setShowProvaModal(false)
      setEditingProva(null)
      await carregar()
      if (provaId) {
        setSelectedProvaId(provaId)
        setActiveTab('etapas')
      }
    } catch (e) {
      alert('Erro a guardar: ' + (e instanceof Error ? e.message : 'erro desconhecido'))
    }
  }

  async function apagarProva(p: Prova) {
    if (!confirm(`Apagar "${p.nome}"? Isto não tem volta a dar.`)) return
    const res = await fetch(`/api/admin/provas/${p.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      alert('Erro a apagar: ' + json.error)
      return
    }
    carregar()
  }

  function selecionarProva(p: Prova) {
    setSelectedProvaId(p.id)
    setActiveTab('etapas')
    setStartlistPaste('')
  }

  async function processarStartlist() {
    if (!selectedProva || !startlistPaste.trim()) return
    setSavingStartlist(true)
    try {
      const res = await fetch('/api/admin/startlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provaId: selectedProva.id, texto: startlistPaste }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert('Erro: ' + json.error)
        return
      }
      alert(`Startlist processada: ${json.total} ciclistas (${json.dnf} DNF).`)
      setStartlistPaste('')
      carregar()
    } finally {
      setSavingStartlist(false)
    }
  }

  async function processarStartlistPdf(ficheiro: File) {
    if (!selectedProva) return
    setSavingStartlistPdf(true)
    try {
      const formData = new FormData()
      formData.append('provaId', selectedProva.id)
      formData.append('arquivo', ficheiro)
      const res = await fetch('/api/admin/startlist/pdf', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        alert('Erro: ' + json.error)
        return
      }
      alert(`Startlist processada a partir do PDF: ${json.total} ciclistas (${json.dnf} DNF).`)
      carregar()
    } catch (e) {
      alert('Erro a processar o PDF: ' + (e instanceof Error ? e.message : 'erro desconhecido'))
    } finally {
      setSavingStartlistPdf(false)
    }
  }

  async function apagarStartlist() {
    if (!selectedProva || selectedProva.startlist.count === 0) return
    if (
      !confirm(
        `Apagar os ${selectedProva.startlist.count} ciclistas da startlist de "${selectedProva.nome}"? Isto não tem volta a dar.`
      )
    ) {
      return
    }
    setApagandoStartlist(true)
    try {
      const res = await fetch('/api/admin/startlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provaId: selectedProva.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert('Erro a apagar: ' + json.error)
        return
      }
      carregar()
    } finally {
      setApagandoStartlist(false)
    }
  }

  function abrirResultados(numeroEtapa: number) {
    setEditingEtapaNumero(numeroEtapa)
    setResultsForm({ classificacao: '', sprint: '', montanha: '', juventude: '' })
    setShowResultsModal(true)
  }

  async function guardarResultados() {
    if (!selectedProva || editingEtapaNumero == null) return
    if (!resultsForm.classificacao.trim() && !resultsForm.sprint.trim() && !resultsForm.montanha.trim() && !resultsForm.juventude.trim()) {
      alert('Cola pelo menos um dos 4 textos.')
      return
    }
    setSavingResults(true)
    try {
      const res = await fetch('/api/admin/resultados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provaId: selectedProva.id,
          numeroEtapa: editingEtapaNumero,
          ...resultsForm,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert('Erro: ' + json.error)
        return
      }
      setShowResultsModal(false)
      carregar()
    } finally {
      setSavingResults(false)
    }
  }

  function atualizarEtapaForm(index: number, campo: keyof EtapaPlaneada, valor: string) {
    if (!editingProva) return
    const etapas = [...editingProva.etapas]
    etapas[index] = { ...etapas[index], [campo]: valor }
    setEditingProva({ ...editingProva, etapas })
  }

  function adicionarEtapaForm() {
    if (!editingProva) return
    setEditingProva({ ...editingProva, etapas: [...editingProva.etapas, emptyEtapa()] })
  }

  function removerEtapaForm(index: number) {
    if (!editingProva) return
    const alvo = editingProva.etapas[index]
    if (alvo.id && !confirm('Esta etapa já tem dados guardados (ex: percurso/elevação). Remover da lista não apaga a etapa na base de dados — só não a mostra aqui. Continuar?')) {
      return
    }
    setEditingProva({ ...editingProva, etapas: editingProva.etapas.filter((_, i) => i !== index) })
  }

  if (loading) return <div style={{ padding: 40 }}>A carregar…</div>

  const navItemStyle = (ativo: boolean): CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: ativo ? 'var(--ink)' : 'var(--on-ink-dim)',
    background: ativo ? 'var(--gold)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    marginBottom: 4,
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', fontFamily: 'Archivo, sans-serif', color: 'var(--text)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: 'var(--ink)',
          color: 'var(--on-ink)',
          padding: '24px 12px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <div className="display-lg" style={{ fontSize: 18, padding: '0 12px', marginBottom: 24, color: 'var(--on-ink)' }}>
          VeloApostas
          <div className="mono" style={{ fontSize: 10, color: 'var(--on-ink-dim)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>
            Admin
          </div>
        </div>
        <nav>
          <button onClick={() => setActiveTab('provas')} style={navItemStyle(activeTab === 'provas')}>
            Provas
          </button>
          <button onClick={() => setActiveTab('etapas')} style={navItemStyle(activeTab === 'etapas')}>
            Etapas
          </button>
        </nav>
      </aside>

      {/* Conteúdo principal */}
      <main style={{ flex: 1, minWidth: 0, padding: 24 }}>
        {erro && <div style={{ color: 'var(--red)', marginBottom: 16 }}>{erro}</div>}

        {/* Barra de estado */}
        <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="mono" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
              Última importação automática
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
              {ultimaImportacao ? (
                ultimaImportacao.sucesso ? (
                  <span style={{ color: '#146633' }}>
                    ✓ Sucesso — <span className="mono">{new Date(ultimaImportacao.executado_em).toLocaleString('pt-PT')}</span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--red)' }}>
                    ✗ Falha — {ultimaImportacao.detalhes} (<span className="mono">{new Date(ultimaImportacao.executado_em).toLocaleString('pt-PT')}</span>)
                  </span>
                )
              ) : (
                <span style={{ color: 'var(--text-dim)' }}>Ainda não correu nenhuma importação automática.</span>
              )}
            </div>
          </div>
        </div>

      {/* Provas tab */}
      {activeTab === 'provas' && (
        <div>
          <button className="btn-primary" style={{ marginBottom: 16 }} onClick={abrirCriarProva}>
            + Criar Prova Nova
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {provas.map(p => (
              <div
                key={p.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => selecionarProva(p)}
              >
                <div>
                  <div className="display-lg" style={{ fontSize: 16, marginBottom: 6 }}>{p.nome}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-dim)' }}>
                    <span className="mono">{p.categoria}</span>
                    <span
                      className="mono"
                      style={{
                        ...statusBadgeStyle(p.status),
                        padding: '2px 8px',
                        borderRadius: 999,
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button className="btn-secondary" style={{ fontSize: 12, padding: '8px 12px' }} onClick={() => abrirEditarProva(p)}>
                    Editar
                  </button>
                  <button className="btn-secondary" style={{ fontSize: 12, padding: '8px 12px' }} onClick={() => apagarProva(p)}>
                    Apagar
                  </button>
                </div>
              </div>
            ))}
            {provas.length === 0 && <div style={{ color: 'var(--text-dim)', padding: 20 }}>Ainda não há nenhuma prova criada.</div>}
          </div>
        </div>
      )}

      {/* Etapas tab */}
      {activeTab === 'etapas' && (
        <div>
          {!selectedProva ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 20px' }}>
              Seleciona uma prova na aba &quot;Provas&quot; para gerir etapas.
            </div>
          ) : (
            <div>
              <button className="btn-secondary" style={{ marginBottom: 16, fontSize: 12, padding: '8px 12px' }} onClick={() => setSelectedProvaId(null)}>
                ← Voltar
              </button>
              <div className="display-lg" style={{ marginBottom: 24 }}>{selectedProva.nome}</div>

              {/* Startlist */}
              <div style={{ background: 'var(--ink)', color: 'var(--on-ink)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 18 }}>Startlist</div>
                  {selectedProva.startlist.count > 0 && (
                    <button
                      onClick={apagarStartlist}
                      disabled={apagandoStartlist}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.25)', color: 'var(--on-ink-dim)', fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                    >
                      {apagandoStartlist ? 'A apagar…' : 'Apagar Startlist'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', padding: 12, textAlign: 'center' }}>
                    <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{selectedProva.startlist.count}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--on-ink-dim)', marginTop: 6 }}>CICLISTAS</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', padding: 12, textAlign: 'center' }}>
                    <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{selectedProva.startlist.dnf}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--on-ink-dim)', marginTop: 6 }}>DNF</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', padding: 12, textAlign: 'center' }}>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                      {selectedProva.startlist.lastSync ? new Date(selectedProva.startlist.lastSync).toLocaleString('pt-PT') : 'Nunca'}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--on-ink-dim)', marginTop: 6 }}>ÚLTIMA SYNC</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 12 }}>
                  <label className="mono" style={{ fontSize: 10, color: 'var(--on-ink-dim)', display: 'block', marginBottom: 6 }}>
                    Carregar PDF da startlist (download direto do procyclingstats)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={savingStartlistPdf}
                    onChange={e => {
                      const ficheiro = e.target.files?.[0]
                      if (ficheiro) processarStartlistPdf(ficheiro)
                      e.target.value = ''
                    }}
                    style={{
                      width: '100%',
                      padding: 8,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--on-ink)',
                      fontSize: 12,
                    }}
                  />
                  {savingStartlistPdf && (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--on-ink-dim)', marginTop: 6 }}>
                      A ler e processar o PDF…
                    </div>
                  )}
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                  <label className="mono" style={{ fontSize: 10, color: 'var(--on-ink-dim)', display: 'block', marginBottom: 6 }}>
                    Colar lista manualmente (reserva, se o PDF falhar)
                  </label>
                  <textarea
                    value={startlistPaste}
                    onChange={e => setStartlistPaste(e.target.value)}
                    placeholder="Cole a startlist aqui..."
                    style={{
                      width: '100%',
                      minHeight: 100,
                      padding: 10,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--on-ink)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                    }}
                  />
                  <button className="btn-primary" style={{ marginTop: 8 }} onClick={processarStartlist} disabled={savingStartlist}>
                    {savingStartlist ? 'A processar…' : 'Processar'}
                  </button>
                </div>
              </div>

              {/* Etapas */}
              <div
                className="mono"
                style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', marginBottom: 12 }}
              >
                Etapas
              </div>

              {selectedProva.etapas_planeadas
                .slice()
                .sort((a, b) => Number(a.numero_etapa) - Number(b.numero_etapa))
                .map(etapa => {
                  const numero = Number(etapa.numero_etapa)
                  const resultado = selectedProva.etapas_resultados.find(r => r.numero_etapa === numero)
                  const badge = importBadge(resultado?.import_status ?? null)
                  const aberta = etapasAbertas.has(numero)
                  return (
                    <div key={numero} className="card" style={{ marginBottom: 16, background: 'var(--surface-2)', padding: 0, overflow: 'hidden' }}>
                      <div
                        onClick={() => alternarEtapaAberta(numero)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 16,
                          cursor: 'pointer',
                          borderBottom: aberta ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', transform: aberta ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>
                            ▶
                          </span>
                          <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>
                            Etapa {numero}{etapa.nome ? ` — ${etapa.nome}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-dim)', alignItems: 'center' }}>
                          <span className="mono">{etapa.data_etapa ?? '—'}</span>
                          <span
                            className="mono"
                            style={{ background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {aberta && (
                        <div style={{ padding: 16 }}>
                          <div style={{ marginBottom: 12 }}>
                            <div className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                              {etapa.distancia_km ?? '—'} km • +{etapa.elevacao_m ?? '—'} m • {etapa.perfil ?? '—'}
                            </div>
                            {(etapa.local_partida || etapa.local_chegada) && (
                              <div className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                                {etapa.local_partida ?? '—'} → {etapa.local_chegada ?? '—'}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                            {(
                              [
                                ['Classificação Geral', resultado?.classificacao_geral_completa ?? null],
                                ['Sprint', resultado?.sprint_completo ?? null],
                                ['Montanha', resultado?.montanha_completo ?? null],
                                ['Juventude', resultado?.juventude_completo ?? null],
                              ] as const
                            ).map(([label, linhas]) => {
                              const presente = !!linhas && linhas.length > 0
                              return (
                                <div
                                  key={label}
                                  className="card"
                                  onClick={() => presente && abrirRanking(`${label} — Etapa ${numero}`, linhas)}
                                  style={{ padding: 12, cursor: presente ? 'pointer' : 'default' }}
                                >
                                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>{label}</div>
                                  <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span
                                      style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: presente ? '#146633' : 'var(--text-dim)',
                                        display: 'inline-block',
                                      }}
                                    />
                                    {presente ? 'Guardado' : 'Falta'}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <button className="btn-secondary" style={{ marginTop: 12, fontSize: 12, padding: '8px 12px' }} onClick={() => abrirResultados(numero)}>
                            Editar Resultados
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              {selectedProva.etapas_planeadas.length === 0 && (
                <div style={{ color: 'var(--text-dim)', padding: 20 }}>Esta prova ainda não tem etapas planeadas.</div>
              )}
            </div>
          )}
        </div>
      )}
      </main>

      {/* Modal criar/editar prova */}
      {showProvaModal && editingProva && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowProvaModal(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 780, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="display-lg" style={{ marginBottom: 20 }}>{editingProva.id ? 'Editar' : 'Criar'} Prova</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nome</label>
              <input
                className="form-field"
                style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                value={editingProva.nome}
                onChange={e => setEditingProva({ ...editingProva, nome: e.target.value })}
                placeholder="Ex: Tour de France 2026"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Categoria</label>
              <select
                className="form-field"
                style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                value={editingProva.categoria}
                onChange={e => setEditingProva({ ...editingProva, categoria: e.target.value })}
              >
                <option value="">Escolhe…</option>
                {CATEGORIAS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Status</label>
              <select
                className="form-field"
                style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                value={editingProva.status}
                onChange={e => setEditingProva({ ...editingProva, status: e.target.value })}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>PCS Slug</label>
              <input
                className="form-field"
                style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                value={editingProva.pcs_slug}
                onChange={e => setEditingProva({ ...editingProva, pcs_slug: e.target.value })}
                placeholder="Ex: tour-de-france"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Data de Início</label>
                <input
                  type="date"
                  className="form-field"
                  style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                  value={editingProva.data_inicio}
                  onChange={e => setEditingProva({ ...editingProva, data_inicio: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Data de Fim</label>
                <input
                  type="date"
                  className="form-field"
                  style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                  value={editingProva.data_fim}
                  onChange={e => setEditingProva({ ...editingProva, data_fim: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
                Etapas Planeadas
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {editingProva.etapas.map((etapa, index) => {
                  const campo = (
                    label: string,
                    valor: string,
                    onChange: (v: string) => void,
                    type: string = 'text'
                  ) => (
                    <div style={{ minWidth: 0 }}>
                      <label className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>
                        {label}
                      </label>
                      <input
                        type={type}
                        value={valor}
                        onChange={e => onChange(e.target.value)}
                        style={{ width: '100%', padding: 6, border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, boxSizing: 'border-box' }}
                      />
                    </div>
                  )
                  return (
                    <div
                      key={index}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                          Etapa {index + 1}
                        </span>
                        <button onClick={() => removerEtapaForm(index)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Remover
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
                        {campo('Num', String(etapa.numero_etapa), v => atualizarEtapaForm(index, 'numero_etapa', v))}
                        {campo('Nome (ex: Chorzów - Zabrze)', etapa.nome ?? '', v => atualizarEtapaForm(index, 'nome', v))}
                        {campo('Data', etapa.data_etapa ?? '', v => atualizarEtapaForm(index, 'data_etapa', v), 'date')}
                        {campo('Perfil', etapa.perfil ?? '', v => atualizarEtapaForm(index, 'perfil', v))}
                        {campo('Dist (km)', String(etapa.distancia_km ?? ''), v => atualizarEtapaForm(index, 'distancia_km', v))}
                        {campo('D+ (m)', String(etapa.elevacao_m ?? ''), v => atualizarEtapaForm(index, 'elevacao_m', v))}
                        {campo('Partida', etapa.local_partida ?? '', v => atualizarEtapaForm(index, 'local_partida', v))}
                        {campo('Chegada', etapa.local_chegada ?? '', v => atualizarEtapaForm(index, 'local_chegada', v))}
                        {campo('Início', etapa.hora_inicio ?? '', v => atualizarEtapaForm(index, 'hora_inicio', v), 'time')}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <label className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>
                          Pontos da Rota (JSON — cola aqui para adicionar/substituir o mapa; deixa em branco para não alterar)
                          {etapa.tem_rota_pontos ? ' — já tem rota guardada' : ''}
                        </label>
                        <textarea
                          value={etapa.rota_pontos_texto ?? ''}
                          onChange={e => atualizarEtapaForm(index, 'rota_pontos_texto', e.target.value)}
                          placeholder='Ex: [{"lat":41.9,"lng":12.5,"elevation":120}, ...]'
                          style={{ width: '100%', minHeight: 50, padding: 6, border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div
                onClick={adicionarEtapaForm}
                style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: 12, textAlign: 'center', cursor: 'pointer', marginTop: 8 }}
              >
                + Adicionar Etapa
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={guardarProva}>Guardar</button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowProvaModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal resultados */}
      {showResultsModal && editingEtapaNumero != null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowResultsModal(false)}
        >
          <div className="card" style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
            <div className="display-lg" style={{ marginBottom: 20 }}>Resultados Etapa {editingEtapaNumero}</div>

            {(
              [
                ['classificacao', 'Classificação Geral'],
                ['sprint', 'Sprint'],
                ['montanha', 'Montanha'],
                ['juventude', 'Juventude'],
              ] as const
            ).map(([campo, label]) => (
              <div key={campo} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
                <textarea
                  style={{ width: '100%', minHeight: 80, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
                  placeholder={`Cole os resultados de ${label.toLowerCase()}...`}
                  value={resultsForm[campo]}
                  onChange={e => setResultsForm({ ...resultsForm, [campo]: e.target.value })}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={guardarResultados} disabled={savingResults}>
                {savingResults ? 'A guardar…' : 'Guardar'}
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowResultsModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de classificação (ranking completo) */}
      {rankingModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setRankingModal(null)}
        >
          <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="display-lg" style={{ fontSize: 18 }}>{rankingModal.titulo}</div>
              <button onClick={() => setRankingModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-dim)' }}>
                ×
              </button>
            </div>
            <table className="mono" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Pos</th>
                  <th style={{ padding: '6px 8px' }}>Nome</th>
                  <th style={{ padding: '6px 8px' }}>Equipa</th>
                  <th style={{ padding: '6px 8px' }}>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {rankingModal.linhas.map(l => (
                  <tr key={l.posicao} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>{l.posicao}</td>
                    <td style={{ padding: '6px 8px' }}>{l.nome}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-dim)' }}>{l.equipa || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{l.tempo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
