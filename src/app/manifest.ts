import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VeloApostas',
    short_name: 'VeloApostas',
    description: 'Sistema de apostas de ciclismo entre amigos',
    start_url: '/',
    display: 'standalone',
    background_color: '#16140F',
    theme_color: '#16140F',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
