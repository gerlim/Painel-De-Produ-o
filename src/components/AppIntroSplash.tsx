'use client'

import { useEffect, useState } from 'react'

export default function AppIntroSplash() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 1700)
    return () => window.clearTimeout(timeout)
  }, [])

  if (!visible) return null

  return (
    <div className="intro-splash" role="status" aria-live="polite">
      <div className="intro-splash-card">
        <img src="/icon-192.png" alt="Logo do Painel Producao" className="intro-splash-logo" />
        <div className="intro-splash-title">PAINEL PRODUCAO</div>
        <div className="intro-splash-subtitle">Carregando painel...</div>
      </div>
    </div>
  )
}

