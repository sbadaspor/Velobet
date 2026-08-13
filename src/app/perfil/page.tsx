'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import NotificationToggle from '@/components/NotificationToggle'

const LOCALIDADES = [
  'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra',
  'Évora', 'Faro', 'Guarda', 'Leiria', 'Lisboa', 'Portalegre',
  'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo', 'Vila Real', 'Viseu',
]

const NACIONALIDADES = [
  'Portuguesa', 'Espanhola', 'Francesa', 'Italiana', 'Brasileira',
  'Britânica', 'Alemã', 'Belga', 'Holandesa', 'Outra',
]

const MESES_EXT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function formatarDataExtenso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d} de ${MESES_EXT[m - 1]} de ${y}`
}

type Perfil = {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  data_nascimento: string | null
  localidade: string | null
  nacionalidade: string | null
  telefone: string | null
}

// ── Ícones (mesmo estilo outline de /hoje) ──
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <polygon points="12 2 15.09 10.26 23.77 10.26 17.39 15.04 20.49 23.31 12 18.54 3.51 23.31 6.61 15.04 0.23 10.26 8.91 10.26 12 2" />
  </svg>
)
const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

const TABS: { label: string; icon: () => React.ReactElement; href: string | null }[] = [
  { label: 'Hoje', icon: HomeIcon, href: '/hoje' },
  { label: 'Próximas', icon: CalendarIcon, href: '/proximas' },
  { label: 'Classificação', icon: StarIcon, href: '/classificacao' },
]

export default function PerfilPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [editing, setEditing] = useState(false)

  // Campos do formulário
  const [nome, setNome] = useState('')
  const [username, setUsername] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [localidade, setLocalidade] = useState('')
  const [nacionalidade, setNacionalidade] = useState('')
  const [telefone, setTelefone] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) { setLoading(false); return }
      setUserId(uid)

      const { data: perfilData } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', uid)
        .single()

      if (perfilData) {
        setPerfil(perfilData as Perfil)
        setNome(perfilData.full_name || '')
        setUsername(perfilData.username || '')
        setDataNascimento(perfilData.data_nascimento || '')
        setLocalidade(perfilData.localidade || '')
        setNacionalidade(perfilData.nacionalidade || '')
        setTelefone(perfilData.telefone || '')
        setAvatarPreview(perfilData.avatar_url || null)
      }
      setLoading(false)
    })()
  }, [])

  const hasAllFields = !!(
    perfil?.full_name &&
    perfil?.username &&
    perfil?.data_nascimento &&
    perfil?.localidade &&
    perfil?.nacionalidade &&
    perfil?.telefone
  )
  const showForm = editing || !hasAllFields

  function handleUsernameChange(value: string) {
    setUsername(value)
    setSaveError('')
    if (usernameTimer.current) clearTimeout(usernameTimer.current)

    const clean = value.trim()
    if (!clean) { setUsernameStatus('idle'); return }
    if (perfil?.username === clean) { setUsernameStatus('idle'); return }

    setUsernameStatus('checking')
    usernameTimer.current = setTimeout(async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('username_disponivel', {
        check_username: clean,
        current_user_id: userId,
      })
      if (error) { setUsernameStatus('idle'); return }
      setUsernameStatus(data ? 'available' : 'taken')
    }, 500)
  }

  function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const isFormValid =
    nome.trim() !== '' &&
    username.trim() !== '' &&
    usernameStatus !== 'taken' &&
    usernameStatus !== 'checking' &&
    dataNascimento !== '' &&
    localidade !== '' &&
    nacionalidade !== '' &&
    telefone.trim() !== ''

  async function handleSave() {
    if (!userId || !isFormValid) return
    setSaving(true)
    setSaveError('')
    const supabase = createClient()

    let avatarUrl = perfil?.avatar_url || null

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop() || 'jpg'
      const path = `${userId}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, cacheControl: '3600' })

      if (uploadError) {
        setSaving(false)
        setSaveError('Não foi possível enviar a foto. Tenta novamente.')
        return
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      avatarUrl = `${pub.publicUrl}?t=${Date.now()}`
    }

    // upsert (não update) — se por algum motivo ainda não existir uma
    // linha em perfis para este utilizador (ex: o trigger de signup
    // falhou), update() não afeta nenhuma linha e falha em silêncio.
    // upsert cria a linha se não existir, e atualiza se já existir.
    const { data, error } = await supabase
      .from('perfis')
      .upsert({
        id: userId,
        full_name: nome.trim(),
        username: username.trim(),
        data_nascimento: dataNascimento,
        localidade,
        nacionalidade,
        telefone: telefone.trim(),
        avatar_url: avatarUrl,
      })
      .select()
      .single()

    setSaving(false)

    if (error) {
      console.error('Erro ao guardar perfil:', error)
      if (error.code === '23505') {
        setSaveError('Esse nome de utilizador já está em uso.')
      } else {
        setSaveError('Não foi possível guardar o perfil. Tenta novamente.')
      }
      return
    }

    setPerfil(data as Perfil)
    setAvatarFile(null)
    setEditing(false)
  }

  function handleCancel() {
    setEditing(false)
    setAvatarFile(null)
    setSaveError('')
    if (perfil) {
      setNome(perfil.full_name || '')
      setUsername(perfil.username || '')
      setDataNascimento(perfil.data_nascimento || '')
      setLocalidade(perfil.localidade || '')
      setNacionalidade(perfil.nacionalidade || '')
      setTelefone(perfil.telefone || '')
      setAvatarPreview(perfil.avatar_url || null)
      setUsernameStatus('idle')
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-bg">
        <div className="flex-1 flex items-center relative">
          <button className="text-xl text-text" aria-label="Menu" onClick={() => setMenuOpen(o => !o)}>☰</button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full left-0 mt-2 z-30 bg-surface border border-border rounded-lg shadow-sm py-1.5 min-w-[200px]">
                <Link href="/historico" className="block px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-2" onClick={() => setMenuOpen(false)}>
                  Histórico
                </Link>
                <Link href="/regras" className="block px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-2" onClick={() => setMenuOpen(false)}>
                  Regras & Pontuação
                </Link>
              </div>
            </>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 text-sm font-medium">
          <span className="w-3 h-3 rounded-full bg-gold" />
          <span>Velo Bet</span>
        </div>
        <div className="flex-1 flex items-center justify-end">
          <div className="w-10 h-10 rounded-full bg-surface-3 border-2 border-border overflow-hidden">
            {avatarPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[560px] mx-auto px-5 py-5">
        <div className="eyebrow mb-3">O meu perfil</div>

        {showForm ? (
          <>
            <div className="display-2xl mb-6">
              {hasAllFields ? 'Editar perfil.' : 'Completa o teu perfil.'}
            </div>

            {/* Avatar upload */}
            <div className="flex justify-center mb-8">
              <button
                type="button"
                onClick={handleAvatarClick}
                className="w-24 h-24 rounded-full bg-surface-3 border-2 border-border flex items-center justify-center overflow-hidden text-text-sub"
                aria-label="Carregar foto de perfil"
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <CameraIcon />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="eyebrow block mb-2">Nome completo</label>
                <input
                  className="input-field"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="O teu nome"
                />
              </div>

              <div>
                <label className="eyebrow block mb-2">Nome de utilizador</label>
                <input
                  className="input-field mono"
                  value={username}
                  onChange={e => handleUsernameChange(e.target.value)}
                  placeholder="username"
                  autoCapitalize="none"
                />
                {usernameStatus === 'checking' && (
                  <div className="text-xs text-text-sub mt-1.5">A verificar...</div>
                )}
                {usernameStatus === 'available' && (
                  <div className="text-xs mt-1.5" style={{ color: 'var(--green-text)' }}>Disponível</div>
                )}
                {usernameStatus === 'taken' && (
                  <div className="text-xs mt-1.5" style={{ color: 'var(--red)' }}>Já existe esse nome de utilizador</div>
                )}
              </div>

              <div>
                <label className="eyebrow block mb-2">Data de nascimento</label>
                <input
                  type="date"
                  className="input-field mono"
                  value={dataNascimento}
                  onChange={e => setDataNascimento(e.target.value)}
                />
              </div>

              <div>
                <label className="eyebrow block mb-2">Localidade</label>
                <select
                  className="input-field"
                  value={localidade}
                  onChange={e => setLocalidade(e.target.value)}
                >
                  <option value="">Seleciona uma localidade</option>
                  {LOCALIDADES.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="eyebrow block mb-2">Nacionalidade</label>
                <select
                  className="input-field"
                  value={nacionalidade}
                  onChange={e => setNacionalidade(e.target.value)}
                >
                  <option value="">Seleciona uma nacionalidade</option>
                  {NACIONALIDADES.map(nat => (
                    <option key={nat} value={nat}>{nat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="eyebrow block mb-2">Número de telefone</label>
                <input
                  type="tel"
                  className="input-field mono"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="912 345 678"
                />
              </div>
            </div>

            {saveError && (
              <div className="text-sm mt-4" style={{ color: 'var(--red)' }}>{saveError}</div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                className="btn-primary flex-1"
                disabled={!isFormValid || saving}
                onClick={handleSave}
              >
                {saving ? 'A guardar...' : 'Guardar perfil'}
              </button>
              {hasAllFields && (
                <button className="btn-secondary" onClick={handleCancel}>
                  Cancelar
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-24 h-24 rounded-full bg-surface-3 border-2 border-border overflow-hidden mb-4">
                {perfil?.avatar_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={perfil.avatar_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="display-xl">{perfil?.full_name}</div>
              <div className="mono text-text-dim mt-1">@{perfil?.username}</div>
            </div>

            <div className="card flex flex-col gap-4">
              <div>
                <div className="eyebrow mb-1">Data de nascimento</div>
                <div className="text-sm font-medium mono">{formatarDataExtenso(perfil!.data_nascimento!)}</div>
              </div>
              <div className="border-t border-border" />
              <div>
                <div className="eyebrow mb-1">Localidade</div>
                <div className="text-sm font-medium">{perfil?.localidade}</div>
              </div>
              <div className="border-t border-border" />
              <div>
                <div className="eyebrow mb-1">Nacionalidade</div>
                <div className="text-sm font-medium">{perfil?.nacionalidade}</div>
              </div>
              <div className="border-t border-border" />
              <div>
                <div className="eyebrow mb-1">Número de telefone</div>
                <div className="text-sm font-medium mono">{perfil?.telefone}</div>
              </div>
            </div>

            <NotificationToggle />

            <button className="btn-secondary w-full mt-6" onClick={() => setEditing(true)}>
              Editar perfil
            </button>
          </>
        )}
      </div>

      {/* Bottom tab bar */}
      <footer className="sticky bottom-0 z-10 flex justify-around py-3 bg-bg">
        {TABS.map(tab => {
          const active = tab.label === 'Eu'
          const content = (
            <div className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide bottom-nav-item ${active ? 'active' : ''}`}>
              <tab.icon />
              <div>{tab.label}</div>
            </div>
          )
          return tab.href ? (
            <Link key={tab.label} href={tab.href} className="flex-1 cursor-pointer">
              {content}
            </Link>
          ) : (
            <div key={tab.label} className="flex-1 cursor-not-allowed opacity-70">
              {content}
            </div>
          )
        })}
      </footer>
    </div>
  )
}
