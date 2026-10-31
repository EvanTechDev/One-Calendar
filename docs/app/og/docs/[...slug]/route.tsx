import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import { getPageImage, source } from '@/lib/source'

const logo = `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), 'public/logo-dark.svg')).toString('base64')}`

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ slug: string[] }>
  },
) {
  const { slug } = await params
  if (slug.at(-1) !== 'image.png') notFound()
  const page = source.getPage(slug.slice(0, -1))
  if (!page) notFound()

  // English text uses the renderer's bundled font without remote requests.
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: 72,
        background: '#171717',
        color: '#fafafa',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 34 }}
      >
        <img src={logo} width={64} height={64} alt="" />
        <span>Zentra</span>
        <span style={{ color: '#a3a3a3' }}>/ Docs</span>
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 76,
          fontSize: 72,
          fontWeight: 600,
        }}
      >
        {page.data.title}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 24,
          fontSize: 30,
          color: '#d4d4d4',
        }}
      >
        {page.data.description}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 'auto',
          paddingTop: 24,
          borderTop: '1px solid #404040',
          fontSize: 24,
          color: '#a3a3a3',
        }}
      >
        {page.url}
      </div>
    </div>,
    { width: 1200, height: 630 },
  )
}

export function generateStaticParams() {
  return source
    .getPages()
    .map((page) => ({ slug: getPageImage(page).segments }))
}
