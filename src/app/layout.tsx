import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VeloApostas',
  description: 'Sistema de apostas de ciclismo entre amigos',
  appleWebApp: {
    title: 'VeloApostas',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#16140F',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  )
}
