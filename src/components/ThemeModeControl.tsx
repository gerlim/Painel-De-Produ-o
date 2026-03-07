'use client'

import { useEffect, useState } from 'react'
import { MoonStar } from 'lucide-react'
import { normalizeThemeMode, resolveTheme, THEME_STORAGE_KEY, type ThemeMode } from '@/lib/theme'

export default function ThemeModeControl() {
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => {
    const stored = normalizeThemeMode(localStorage.getItem(THEME_STORAGE_KEY))
    setMode(stored)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolved = resolveTheme(mode, media.matches)
      document.documentElement.setAttribute('data-theme', resolved)
      document.documentElement.style.colorScheme = resolved
    }

    applyTheme()
    localStorage.setItem(THEME_STORAGE_KEY, mode)

    const onChange = () => {
      if (mode === 'system') applyTheme()
    }

    if (media.addEventListener) media.addEventListener('change', onChange)
    else media.addListener(onChange)

    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange)
      else media.removeListener(onChange)
    }
  }, [mode])

  return (
    <label
      style={{
        border: '1px solid var(--border)',
        background: 'var(--ink-700)',
        color: 'var(--text-primary)',
        borderRadius: 8,
        padding: '6px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <MoonStar size={13} />
      <select
        value={mode}
        onChange={(event) => setMode(event.target.value as ThemeMode)}
        aria-label="Modo de tema"
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-primary)',
          fontSize: 12,
          outline: 'none',
          minWidth: 84,
        }}
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
      </select>
    </label>
  )
}
