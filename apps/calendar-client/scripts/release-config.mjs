import { readFileSync, writeFileSync } from 'node:fs'

const environment = process.env.ZENTRA_DESKTOP_ENV
const version = process.env.RELEASE_VERSION
if (!['dev', 'production'].includes(environment))
  throw new Error('Invalid release environment')
if (!/^\d+\.\d+\.\d+$/.test(version ?? ''))
  throw new Error('Release version must be X.Y.Z')
if (version.split('.').some((part) => Number(part) > 65535))
  throw new Error('Version exceeds installer limits')
if (
  !process.env.ZENTRA_UPDATER_PUBLIC_KEY ||
  !process.env.TAURI_SIGNING_PRIVATE_KEY
) {
  throw new Error(
    'Configure the updater public key and signing private key for this environment',
  )
}
const dev = environment === 'dev'
const config = dev
  ? JSON.parse(readFileSync('src-tauri/tauri.dev.conf.json', 'utf8'))
  : {}
config.version = version
config.bundle = { ...config.bundle, createUpdaterArtifacts: true }
writeFileSync(
  'src-tauri/tauri.release.conf.json',
  `${JSON.stringify(config, null, 2)}\n`,
)
