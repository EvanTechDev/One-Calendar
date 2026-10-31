import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { initWasm, Resvg } from '@resvg/resvg-wasm'

const require = createRequire(import.meta.url)
const wasm = join(
  dirname(require.resolve('@resvg/resvg-wasm')),
  'index_bg.wasm',
)
await initWasm(readFileSync(wasm))
const svg = readFileSync(
  new URL(
    '../../../packages/ui/src/calendar/assets/product-logo.svg',
    import.meta.url,
  ),
)
const icons = new URL('../src-tauri/icons/', import.meta.url)
const image = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } })
writeFileSync(new URL('icon.png', icons), image.render().asPng())
writeFileSync(new URL('icon.svg', icons), svg)
image.free()
// --png-only also works on hosts without a native Tauri CLI (e.g. Android).
if (!process.argv.includes('--png-only')) {
  execFileSync(
    'bun',
    ['run', 'tauri', 'icon', new URL('icon.png', icons).pathname],
    {
      cwd: new URL('../', import.meta.url),
      stdio: 'inherit',
    },
  )
}
