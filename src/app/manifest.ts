import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sonara',
    short_name: 'Sonara',
    description: 'AI Music Generation Studio',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d0d12',
    theme_color: '#0d0d12',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
