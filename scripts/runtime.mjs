import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const apps = ['calendar', 'meet']
const commands = ['dev', 'build', 'start']
const bunVersions = ['1.x', '1.4.x']
const usage =
  'Usage: node scripts/runtime.mjs <status|node|bun [--bun-version 1.x|1.4.x]>'

function readJson(path) {
  const url = new URL(path, root)
  const original = readFileSync(url, 'utf8')
  const value = JSON.parse(original)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path}: expected a JSON object`)
  }
  return { url, original, value, snapshot: JSON.stringify(value) }
}

function nextCommand(script, command, path) {
  // Accept a final Next CLI command, retaining prerequisite commands and flags.
  // Unknown wrappers are rejected rather than overwritten.
  const match =
    typeof script === 'string' &&
    script.match(/(^| && )(bun run --bun )?next (dev|build|start)([^&|;\n]*)$/)
  if (
    !match ||
    match[3] !== command ||
    (match[4] && !match[4].startsWith(' '))
  ) {
    throw new Error(
      `${path}: unsupported scripts.${command}; expected a final next ${command} command`,
    )
  }
  return match
}

function showStatus() {
  const runtimes = new Set()
  let consistent = true
  for (const app of apps) {
    const path = `apps/${app}/package.json`
    const pkg = readJson(path).value
    const vercel = readJson(`apps/${app}/vercel.json`).value
    const version = vercel.bunVersion
    const deployed = version === undefined ? 'Node.js' : `Bun (${version})`
    const expected = version === undefined ? 'node' : 'bun'
    let valid = version === undefined || bunVersions.includes(version)
    const local = commands.map((command) => {
      const match = nextCommand(pkg.scripts?.[command], command, path)
      const runtime = match[2] ? 'bun' : 'node'
      if (runtime !== expected) valid = false
      return `${command}=${runtime}`
    })
    runtimes.add(deployed)
    consistent &&= valid
    console.log(
      `${app}: ${deployed}; ${local.join(', ')}${valid ? '' : ' [mixed/unsupported]'}`,
    )
  }
  if (!consistent || runtimes.size !== 1) {
    console.log(
      'Mixed/unsupported configuration. Run runtime:node or runtime:bun to align both apps.',
    )
    process.exitCode = 1
  }
  console.log(
    'Status describes repository configuration, not the live Vercel deployment.',
  )
}

function switchRuntime(mode, bunVersion) {
  const files = []
  // Validate every file before changing any of them.
  for (const app of apps) {
    const packagePath = `apps/${app}/package.json`
    const pkg = readJson(packagePath)
    const vercel = readJson(`apps/${app}/vercel.json`)
    for (const command of commands) {
      const script = pkg.value.scripts?.[command]
      const match = nextCommand(script, command, packagePath)
      const prefix = script.slice(0, match.index) + match[1]
      pkg.value.scripts[command] =
        `${prefix}${mode === 'bun' ? 'bun run --bun ' : ''}next ${command}${match[4]}`
    }
    if (mode === 'bun') vercel.value.bunVersion = bunVersion
    else delete vercel.value.bunVersion
    files.push(pkg, vercel)
  }
  const changed = files.filter(
    (file) => JSON.stringify(file.value) !== file.snapshot,
  )
  const attempted = []
  try {
    for (const file of changed) {
      attempted.push(file)
      writeFileSync(file.url, JSON.stringify(file.value, null, 2) + '\n')
    }
  } catch (error) {
    // Best-effort rollback on write errors, including a partially written file.
    for (const file of attempted.reverse()) {
      try {
        writeFileSync(file.url, file.original)
      } catch (rollbackError) {
        console.error(
          `Could not restore ${file.url.pathname}: ${rollbackError.message}`,
        )
      }
    }
    throw error
  }
  console.log(
    `calendar + meet: ${mode === 'bun' ? `Bun (${bunVersion})` : 'Node.js'}; ${changed.length} file(s) changed`,
  )
  console.log(
    'Restart local servers. Redeploy both Vercel projects to apply the runtime change.',
  )
  if (mode === 'bun')
    console.log(
      'Local dev/build/start requires Bun; Bun remains the package manager in either runtime mode.',
    )
}

try {
  const [mode, ...extra] = process.argv.slice(2)
  const bunVersion = extra.length === 0 ? '1.x' : extra[1]
  const versionOption =
    mode === 'bun' &&
    extra.length === 2 &&
    extra[0] === '--bun-version' &&
    bunVersions.includes(bunVersion)
  if (
    !['node', 'bun', 'status', 'help', '--help'].includes(mode) ||
    (extra.length && !versionOption)
  ) {
    throw new Error(usage)
  }
  if (mode === 'help' || mode === '--help') console.log(usage)
  else if (mode === 'status') showStatus()
  else switchRuntime(mode, bunVersion)
} catch (error) {
  console.error(`Runtime switch failed: ${error.message}`)
  process.exitCode = 1
}
