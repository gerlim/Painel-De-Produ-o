'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import ThemeModeControl from '@/components/ThemeModeControl'

type AuthMode = 'login' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [mode, setMode] = useState<AuthMode>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const isSignup = mode === 'signup'

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) router.replace('/')
    })
  }, [router, supabase])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) {
      setError('Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para habilitar login.')
      return
    }
    setLoading(true)
    setError('')

    if (isSignup) {
      if (displayName.trim().length < 2) {
        setError('Informe seu nome para a solicitacao de cadastro.')
        setLoading(false)
        return
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      if (data.session) {
        await supabase.auth.signOut()
      }

      setSuccess('Solicitacao enviada. Aguarde aprovacao do administrador para acessar o app.')
      setPassword('')
      setLoading(false)
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.replace('/')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
      className="z-content"
    >
      <form
        onSubmit={onSubmit}
        className="card fade-up"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 24,
          borderRadius: 16,
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
                color: 'var(--cyan)',
                letterSpacing: '0.06em',
                lineHeight: 1,
              }}
            >
              PAINEL PRODUCAO
            </h1>
            <ThemeModeControl />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
            {isSignup ? 'Solicite seu cadastro com email e senha' : 'Login com email e senha'}
          </p>
        </div>

        {!supabase && (
          <div
            style={{
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: 8,
              color: '#fbbf24',
              fontSize: 12,
              padding: '9px 10px',
              marginBottom: 12,
            }}
          >
            Defina as variaveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para usar autenticacao.
          </div>
        )}

        {isSignup && (
          <>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              Nome
            </label>
            <input
              required
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--ink-700)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 12px',
                color: 'var(--text-primary)',
                marginBottom: 12,
              }}
            />
          </>
        )}

        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          Email
        </label>
        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--ink-700)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 12px',
            color: 'var(--text-primary)',
            marginBottom: 12,
          }}
        />

        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          Senha
        </label>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--ink-700)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 12px',
            color: 'var(--text-primary)',
            marginBottom: 14,
          }}
        />

        {error && (
          <div
            style={{
              background: 'rgba(244,63,94,0.1)',
              border: '1px solid rgba(244,63,94,0.25)',
              borderRadius: 8,
              color: '#fb7185',
              fontSize: 12,
              padding: '9px 10px',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.35)',
              borderRadius: 8,
              color: '#34d399',
              fontSize: 12,
              padding: '9px 10px',
              marginBottom: 12,
            }}
          >
            {success}
          </div>
        )}

        <button
          disabled={loading}
          type="submit"
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--cyan)',
            color: 'var(--ink-950)',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <LogIn size={16} />
          {loading ? 'Processando...' : isSignup ? 'Solicitar cadastro' : 'Entrar'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === 'login' ? 'signup' : 'login'))
            setError('')
            setSuccess('')
          }}
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '10px 14px',
            marginTop: 10,
            background: 'var(--ink-700)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          {isSignup ? 'Ja tenho conta' : 'Solicitar novo cadastro'}
        </button>
      </form>
    </main>
  )
}
