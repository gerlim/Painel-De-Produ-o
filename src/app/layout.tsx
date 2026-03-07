import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Bebas_Neue, DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import PwaRegister from '@/components/PwaRegister'
import AppIntroSplash from '@/components/AppIntroSplash'
import { getThemeInitScript } from '@/lib/theme'

const display = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
})

const body = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
})

const mono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Painel Producao - Dashboard',
  description: 'Dashboard de producao Hanway 2504 Elite',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  applicationName: 'Painel Producao',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0e14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {getThemeInitScript()}
        </Script>
        <PwaRegister />
        <AppIntroSplash />
        {children}
      </body>
    </html>
  )
}
