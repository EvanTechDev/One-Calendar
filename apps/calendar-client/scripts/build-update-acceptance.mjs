import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const keys = mkdtempSync(join(tmpdir(), 'zentra-updater-keys-'))
const cli = resolve('node_modules/@tauri-apps/cli/tauri.js')
const bundle = `src-tauri/target/${process.env.BUILD_TARGET}/release/bundle`
function tauri(args, env = process.env, stdio = 'inherit') {
  execFileSync(process.execPath, [cli, ...args], { env, stdio })
}
try {
  // The disposable private key never leaves the runner or enters an artifact.
  tauri(
    [
      'signer',
      'generate',
      '--ci',
      '--password',
      '',
      '--write-keys',
      join(keys, 'key'),
    ],
    process.env,
    'pipe',
  )
  const env = {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: readFileSync(join(keys, 'key'), 'utf8').trim(),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '',
    ZENTRA_UPDATER_PUBLIC_KEY: readFileSync(
      join(keys, 'key.pub'),
      'utf8',
    ).trim(),
  }
  for (const version of ['0.0.2', '0.0.1']) {
    rmSync(bundle, { recursive: true, force: true })
    execFileSync(process.execPath, ['scripts/release-config.mjs'], {
      env: { ...env, RELEASE_VERSION: version },
    })
    const configPath = 'src-tauri/tauri.release.conf.json'
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    config.plugins = {
      ...config.plugins,
      updater: {
        pubkey: env.ZENTRA_UPDATER_PUBLIC_KEY,
        dangerousInsecureTransportProtocol: true,
        windows: { installMode: 'quiet' },
      },
    }
    writeFileSync(configPath, JSON.stringify(config))
    tauri(
      [
        'build',
        '--features',
        'acceptance',
        '--target',
        env.BUILD_TARGET,
        '--bundles',
        env.BUILD_BUNDLE,
        '--config',
        configPath,
        '--',
        '--locked',
      ],
      env,
    )
    if (version === '0.0.2') {
      execFileSync(process.execPath, ['scripts/collect-release.mjs'], {
        env,
        stdio: 'inherit',
      })
      const fragment = JSON.parse(
        readFileSync(`release-artifacts/${env.BUILD_TARGET}.json`, 'utf8'),
      )
      mkdirSync('update-acceptance-assets', { recursive: true })
      copyFileSync(
        `release-artifacts/${fragment.asset}`,
        `update-acceptance-assets/${fragment.asset}`,
      )
      writeFileSync(
        'update-acceptance-assets/target.json',
        JSON.stringify(fragment),
      )
    }
  }
} finally {
  rmSync(keys, { recursive: true, force: true })
}
