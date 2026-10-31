import { source } from '@/lib/source'
import { getBaseUrl } from '@/lib/base-url'
import { site } from '@/lib/site'

export const revalidate = false

export async function GET() {
  const lines = [`# ${site.name}`, '', site.description, '']
  for (const page of source.getPages()) {
    lines.push(
      `- [${page.data.title}](${new URL(`${page.url}.mdx`, getBaseUrl())}): ${page.data.description}`,
    )
  }
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
