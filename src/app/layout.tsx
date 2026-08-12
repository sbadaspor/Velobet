import type { Metadata, Viewport } from 'next'
import './globals.css'
import NotificationGate from '@/components/NotificationGate'

export const metadata: Metadata = {
  title: 'Velo Bet',
  description: 'Sistema de apostas de ciclismo entre amigos',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    title: 'Velo Bet',
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
      <body>
        {children}
        <NotificationGate />
      </body>
    </html>
  )
}
