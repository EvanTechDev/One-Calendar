import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zentra Calendar',
    short_name: 'Zentra Calendar',
    description: 'The next gen calendar powered by AI agent.',
    id: '/app',
    start_url: '/app',
    scope: '/app',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#0b0f1a',
    theme_color: '#0b0f1a',
    lang: 'en',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
