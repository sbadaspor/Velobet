import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Velobet',
  description: 'Sistema de apostas de ciclismo entre amigos',
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
