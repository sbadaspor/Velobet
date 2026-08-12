'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePassword(password: string) {
  return password.length >= 8
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [screen, setScreen] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginEmailError, setLoginEmailError] = useState('')
  const [loginPasswordError, setLoginPasswordError] = useState('')

  // Signup state
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [signupEmailError, setSignupEmailError] = useState('')
  const [signupPasswordError, setSignupPasswordError] = useState('')
  const [signupConfirmPasswordError, setSignupConfirmPasswordError] = useState('')

  const resetLoginErrors = () => {
    setLoginEmailError('')
    setLoginPasswordError('')
  }

  const handleLoginSubmit = async () => {
    resetLoginErrors()
    let hasError = false

    if (!loginEmail) {
      setLoginEmailError('Email é obrigatório')
      hasError = true
    } else if (!validateEmail(loginEmail)) {
      setLoginEmailError('Email inválido')
      hasError = true
    }
    if (!loginPassword) {
      setLoginPasswordError('Palavra-passe é obrigatória')
      hasError = true
    }
    if (hasError) return

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    setLoading(false)

    if (error) {
      setLoginPasswordError('Credenciais inválidas. Verifica o email e a palavra-passe.')
      return
    }
    router.push('/hoje')
    router.refresh()
  }

  const handleSignupSubmit = async () => {
    setSignupEmailError('')
    setSignupPasswordError('')
    setSignupConfirmPasswordError('')
    let hasError = false

    if (!signupEmail) {
      setSignupEmailError('Email é obrigatório')
      hasError = true
    } else if (!validateEmail(signupEmail)) {
      setSignupEmailError('Email inválido')
      hasError = true
    }
    if (!signupPassword) {
      setSignupPasswordError('Palavra-passe é obrigatória')
      hasError = true
    } else if (!validatePassword(signupPassword)) {
      setSignupPasswordError('Palavra-passe deve ter pelo menos 8 caracteres')
      hasError = true
    }
    if (!signupConfirmPassword) {
      setSignupConfirmPasswordError('Confirmação é obrigatória')
      hasError = true
    } else if (signupPassword !== signupConfirmPassword) {
      setSignupConfirmPasswordError('Palavras-passe não coincidem')
      hasError = true
    }
    if (hasError) return

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
    })
    setLoading(false)

    if (error) {
      setSignupEmailError(error.message)
      return
    }
    setScreen('login')
  }

  return (
    <div className="page-shell">
      <div className="page-frame p-8">
        <div className="text-center mb-8">
          <div className="font-display text-[28px] text-text">VeloApostas</div>
        </div>

        {screen === 'login' ? (
          <div>
            <div className="mb-5">
              <label className="block text-[13px] font-semibold text-text mb-1.5">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="exemplo@email.com"
                value={loginEmail}
                onChange={e => { setLoginEmail(e.target.value); setLoginEmailError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()}
              />
              {loginEmailError && <div className="text-[12px] text-red mt-1">{loginEmailError}</div>}
            </div>

            <div className="flex justify-between items-baseline mb-1.5">
              <label className="text-[13px] font-semibold text-text">Palavra-passe</label>
              <a
                className="text-[13px] text-text-dim cursor-pointer hover:text-text"
                onClick={() => router.push('/auth/forgot-password')}
              >
                Esqueci a password
              </a>
            </div>
            <div className="mb-5">
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => { setLoginPassword(e.target.value); setLoginPasswordError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLoginSubmit()}
              />
              {loginPasswordError && <div className="text-[12px] text-red mt-1">{loginPasswordError}</div>}
            </div>

            <button className="btn-primary w-full" disabled={loading} onClick={handleLoginSubmit}>
              {loading ? 'A entrar…' : 'Entrar'}
            </button>

            <div className="text-center mt-5 text-[14px] text-text-dim">
              Não tens conta?{' '}
              <a className="text-text font-semibold cursor-pointer hover:text-gold" onClick={() => setScreen('signup')}>
                Regista-te aqui
              </a>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-5">
              <label className="block text-[13px] font-semibold text-text mb-1.5">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="exemplo@email.com"
                value={signupEmail}
                onChange={e => { setSignupEmail(e.target.value); setSignupEmailError('') }}
              />
              {signupEmailError && <div className="text-[12px] text-red mt-1">{signupEmailError}</div>}
            </div>

            <div className="mb-5">
              <label className="block text-[13px] font-semibold text-text mb-1.5">Palavra-passe</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={signupPassword}
                onChange={e => { setSignupPassword(e.target.value); setSignupPasswordError('') }}
              />
              {signupPasswordError && <div className="text-[12px] text-red mt-1">{signupPasswordError}</div>}
            </div>

            <div className="mb-5">
              <label className="block text-[13px] font-semibold text-text mb-1.5">Confirmar Palavra-passe</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={signupConfirmPassword}
                onChange={e => { setSignupConfirmPassword(e.target.value); setSignupConfirmPasswordError('') }}
              />
              {signupConfirmPasswordError && <div className="text-[12px] text-red mt-1">{signupConfirmPasswordError}</div>}
            </div>

            <button className="btn-primary w-full" disabled={loading} onClick={handleSignupSubmit}>
              {loading ? 'A registar…' : 'Registar'}
            </button>

            <div className="text-center mt-5 text-[14px] text-text-dim">
              Já tens conta?{' '}
              <a className="text-text font-semibold cursor-pointer hover:text-gold" onClick={() => setScreen('login')}>
                Entra aqui
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
