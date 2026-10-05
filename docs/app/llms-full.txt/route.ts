import { getLLMText, source } from '@/lib/source'
import { site } from '@/lib/site'

export const revalidate = false

export async function GET() {
  const scan = source.getPages().map(getLLMText)
  const scanned = await Promise.all(scan)

  return new Response(
    `# ${site.name}\n\n${site.description}\n\n${scanned.join('\n\n---\n\n')}`,
    {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    },
  )
}
