import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import { createHash } from 'node:crypto'

const target = process.env.BUILD_TARGET
const platforms = {
  'x86_64-unknown-linux-gnu': 'linux-x86_64',
  'x86_64-pc-windows-msvc': 'windows-x86_64',
  'x86_64-apple-darwin': 'darwin-x86_64',
  'aarch64-apple-darwin': 'darwin-aarch64',
}
if (!platforms[target]) throw new Error('Unknown release target')
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}
const artifacts = files(`src-tauri/target/${target}/release/bundle`)
const extension = target.includes('linux')
  ? '.AppImage'
  : target.includes('windows')
    ? '.exe'
    : '.app.tar.gz'
const updates = artifacts.filter(
  (path) => path.endsWith(extension) && artifacts.includes(`${path}.sig`),
)
if (updates.length !== 1)
  throw new Error(
    `Expected one signed updater for ${target}, found ${updates.length}`,
  )
mkdirSync('release-artifacts', { recursive: true })
const checksums = []
for (const path of artifacts.filter((path) =>
  /\.(AppImage|exe|dmg|app\.tar\.gz)(\.sig)?$/.test(path),
)) {
  const name = `${target}-${basename(path)}`
  copyFileSync(path, join('release-artifacts', name))
  checksums.push(
    `${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${name}`,
  )
}
writeFileSync(
  `release-artifacts/${target}-SHA256SUMS`,
  `${checksums.join('\n')}\n`,
)
writeFileSync(
  `release-artifacts/${target}.json`,
  JSON.stringify({
    platform: platforms[target],
    asset: `${target}-${basename(updates[0])}`,
    signature: readFileSync(`${updates[0]}.sig`, 'utf8').trim(),
  }),
)
