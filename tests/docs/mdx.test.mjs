import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const docsDir = fileURLToPath(new URL('../../docs/', import.meta.url))
const require = createRequire(join(docsDir, 'package.json'))
const { default: loader } = await import(
  pathToFileURL(require.resolve('fumadocs-mdx/webpack/mdx')).href
)

// Use the production loader and the generated project config, rather than
// type-checking generated imports without compiling the Markdown itself.
process.chdir(docsDir)

async function compile(file, source) {
  return new Promise((resolveResult, reject) => {
    loader.call(
      {
        async: () => (error, code) => {
          if (error) reject(error)
          else resolveResult(code)
        },
        getOptions: () => ({
          configPath: resolve('source.config.ts'),
          outDir: resolve('.source'),
          absoluteCompiledConfigPath: resolve('.source/source.config.mjs'),
          isDev: false,
        }),
        cacheable() {},
        addDependency() {},
        resourcePath: file,
        resourceQuery: '?collection=docs',
        mode: 'production',
      },
      source,
    )
  })
}

test('production MDX preserves explicit emphasis elements in Markdown exports', async () => {
  const file = resolve('content/docs/calendar/import-export.mdx')
  const source = await readFile(file, 'utf8')
  const frontmatter = source.match(/^---\r?\n[\s\S]*?\r?\n---/)[0]
  const code = await compile(
    file,
    `${frontmatter}\n\nKeep <strong>bold text</strong> and <em>italic text</em> visible.\n`,
  )
  assert.match(code, /_markdown/)
  assert.match(code, /<strong>bold text<\/strong>/)
  assert.match(code, /<em>italic text<\/em>/)
})

test('every documentation page compiles through the production MDX loader', async () => {
  const contentDir = resolve('content/docs')
  const entries = await readdir(contentDir, { recursive: true })
  const pages = entries.filter((entry) => entry.endsWith('.mdx')).sort()
  assert.ok(pages.length > 0)
  for (const page of pages) {
    const file = join(contentDir, page)
    const code = await compile(file, await readFile(file, 'utf8'))
    assert.match(code, /_markdown/, `${page}: missing Markdown export`)
    assert.match(code, /MDXContent/, `${page}: missing page component`)
  }
})
