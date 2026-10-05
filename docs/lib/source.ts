import { docs } from 'fumadocs-mdx:collections/server'
import { type InferPageType, loader } from 'fumadocs-core/source'
import { createElement } from 'react'
import { icons } from 'lucide-react'
import { AssistantIcon } from '@/components/assistant-icon'

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  icon(name) {
    if (!name) return
    if (name === 'Assistant') return createElement(AssistantIcon)
    const Icon = icons[name as keyof typeof icons]
    if (Icon) return createElement(Icon)
  },
})

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png']

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  }
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed')

  return `# ${page.data.title}

${processed}`
}
