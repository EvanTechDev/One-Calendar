import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' })
const version = process.env.RELEASE_VERSION
const dev = process.env.ZENTRA_DESKTOP_ENV === 'dev'
const tag = dev ? `desktop-dev-v${version}` : `desktop-v${version}`
const channel = dev ? 'desktop-dev' : 'desktop-stable'
const repository = process.env.GITHUB_REPOSITORY
const directory = process.argv[2] ?? 'release-artifacts'
if (!/^\d+\.\d+\.\d+$/.test(version ?? ''))
  throw new Error('Invalid release version')
const fragments = readdirSync(directory)
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(join(directory, file), 'utf8')))
const expected = [
  'darwin-aarch64',
  'darwin-x86_64',
  'linux-x86_64',
  'windows-x86_64',
]
if (
  fragments.length !== 4 ||
  expected.some(
    (platform) =>
      fragments.filter((fragment) => fragment.platform === platform).length !==
      1,
  )
) {
  throw new Error(
    'All four signed platform artifacts are required before publishing',
  )
}
const manifest = {
  version,
  notes: `Zentra Calendar ${dev ? 'Dev ' : ''}${version}. Windows publisher signing and macOS notarization are not included in this release.`,
  pub_date: new Date().toISOString(),
  platforms: Object.fromEntries(
    fragments.map(({ platform, asset, signature }) => {
      if (!signature || !readdirSync(directory).includes(asset))
        throw new Error('Missing updater asset or signature')
      return [
        platform,
        {
          signature,
          url: `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(asset)}`,
        },
      ]
    }),
  ),
}
writeFileSync(
  join(directory, 'latest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
const assets = readdirSync(directory)
  .filter((file) => !file.endsWith('.json') || file === 'latest.json')
  .map((file) => join(directory, file))
// The versioned release is immutable. A repeat run fails rather than replacing
// bytes that an installed application might already be downloading.
gh(
  'release',
  'create',
  tag,
  '--target',
  process.env.GITHUB_SHA,
  '--title',
  `Desktop ${dev ? 'Dev ' : ''}${version}`,
  '--notes',
  manifest.notes,
  '--draft',
  ...assets,
)
gh('release', 'edit', tag, '--draft=false', ...(dev ? ['--prerelease'] : []))
let exists = false
try {
  gh('release', 'view', channel)
  exists = true
} catch {
  /* First channel release. */
}
if (exists) {
  const old = JSON.parse(
    gh('api', `repos/${repository}/releases/tags/${channel}`),
  )
  const asset = old.assets.find((item) => item.name === 'latest.json')
  if (asset) {
    const previous = JSON.parse(
      gh(
        'api',
        '-H',
        'Accept: application/octet-stream',
        `repos/${repository}/releases/assets/${asset.id}`,
      ),
    )
    const before = previous.version.split('.').map(Number)
    const after = version.split('.').map(Number)
    const difference =
      after
        .map((part, index) => part - before[index])
        .find((part) => part !== 0) ?? 0
    if (difference <= 0)
      throw new Error(
        'Refusing to move the update channel backwards or replace the same version',
      )
  }
  gh('release', 'upload', channel, join(directory, 'latest.json'), '--clobber')
} else {
  gh(
    'release',
    'create',
    channel,
    '--target',
    process.env.GITHUB_SHA,
    '--title',
    `Desktop ${dev ? 'Dev' : 'Stable'} updates`,
    '--notes',
    'Signed desktop update channel.',
    '--prerelease',
    join(directory, 'latest.json'),
  )
}
