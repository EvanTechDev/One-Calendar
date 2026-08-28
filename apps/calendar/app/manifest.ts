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
        // The light variant explicitly, not `/icon.svg`. An installed app's
        // icon is rasterised once by the OS, and that rasteriser does not
        // reliably evaluate the `prefers-color-scheme` query `/icon.svg` uses —
        // so which of the two variants got baked in would be luck. The artwork
        // is self-contained (its own gradient plate), so it does not need to
        // match the launcher's theme.
        src: '/logo-light.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
