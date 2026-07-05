import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { pageSchema } from 'fumadocs-core/source/schema'
import { z } from 'zod'

export const docs = defineDocs({
  dir: 'content',
  docs: {
    schema: pageSchema.extend({
      date: z.string(),
      tags: z.array(z.string()).optional(),
      version: z.string().optional(),
    }),
  },
})

export default defineConfig({
  mdxOptions: {
    providerImportSource: '@/mdx-components',
  },
})
