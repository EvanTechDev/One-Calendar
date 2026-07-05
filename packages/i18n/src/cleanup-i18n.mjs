import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const localesDir = path.join(projectRoot, 'src', 'calendar', 'locales')
const sourceLocale = 'en.json'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve))

/**
 * Parses user input like "1, 3-5, 8" into an array of 0-based indices.
 */
function parseIndices(input, max) {
  if (input.toLowerCase() === 'all') {
    return Array.from({ length: max }, (_, i) => i)
  }

  const result = new Set()
  const parts = input.split(/[\s,]+/)

  for (const part of parts) {
    if (part.includes('-')) {
      const split = part.split('-').map((n) => parseInt(n.trim(), 10))
      if (split.length === 2) {
        const [start, end] = split
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= max) result.add(i - 1)
          }
        }
      }
    } else {
      const n = parseInt(part.trim(), 10)
      if (!isNaN(n) && n >= 1 && n <= max) {
        result.add(n - 1)
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b)
}

async function getFiles(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name)
      return dirent.isDirectory() ? getFiles(res) : res
    }),
  )
  return files.flat()
}

/**
 * Escapes special characters for use in a regular expression.
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function run() {
  console.log('🔍 Scanning for unused i18n keys...')

  const enPath = path.join(localesDir, sourceLocale)
  const enContent = await fs.readFile(enPath, 'utf8')
  const enJson = JSON.parse(enContent)
  const keys = Object.keys(enJson)

  const searchDirs = ['app', 'components', 'lib', 'hooks']
  let allCodeFiles = []
  for (const dir of searchDirs) {
    const fullPath = path.join(projectRoot, dir)
    try {
      const files = await getFiles(fullPath)
      allCodeFiles = allCodeFiles.concat(
        files.filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f)),
      )
    } catch (e) {
      // Directory might not exist
    }
  }

  console.log(`📄 Found ${allCodeFiles.length} code files.`)
  console.log(`🔑 Found ${keys.length} keys in ${sourceLocale}.`)

  const fileContents = await Promise.all(
    allCodeFiles.map(async (f) => {
      const content = await fs.readFile(f, 'utf8')
      return { path: f, content }
    }),
  )

  const unusedKeys = []

  for (const key of keys) {
    let used = false
    const escapedKey = escapeRegExp(key)

    // Patterns to look for
    // Using string concatenation for the regex to avoid backtick escaping issues in template literals
    const patterns = [
      new RegExp('t(\\.|\\?\\.)' + escapedKey + '\\b'),
      new RegExp('t\\[[\'"`]' + escapedKey + '[\'"`]\\]'),
      new RegExp('\\{\\s*[^}]*\\b' + escapedKey + '\\b[^}]*\\}\\s*=\\s*t\\b'),
      new RegExp('[\'"`]' + escapedKey + '[\'"`]'),
    ]

    for (const { content } of fileContents) {
      if (patterns.some((pattern) => pattern.test(content))) {
        used = true
        break
      }
    }

    if (!used) {
      unusedKeys.push(key)
    }
  }

  if (unusedKeys.length === 0) {
    console.log('✅ No unused keys found!')
    process.exit(0)
  }

  console.log(`\nFound ${unusedKeys.length} potentially unused keys:`)
  unusedKeys.forEach((key, index) => {
    console.log(`${index + 1}. ${key}`)
  })

  console.log('\nOptions:')
  console.log('- Enter indices to delete (e.g., "1, 3-5, 8")')
  console.log('- Type "all" to delete everything listed')
  console.log('- Press Enter to cancel')

  const input = await question('\nYour selection: ')
  const selectedIndices = parseIndices(input, unusedKeys.length)

  if (selectedIndices.length > 0) {
    const keysToDelete = selectedIndices.map((i) => unusedKeys[i])

    console.log(`\nSelected ${keysToDelete.length} keys for deletion.`)
    const confirm = await question('Are you sure you want to proceed? (y/N): ')

    if (confirm.toLowerCase() === 'y') {
      const localeFiles = (await fs.readdir(localesDir)).filter((f) =>
        f.endsWith('.json'),
      )

      for (const file of localeFiles) {
        const filePath = path.join(localesDir, file)
        const content = await fs.readFile(filePath, 'utf8')
        const json = JSON.parse(content)

        let deletedCount = 0
        for (const key of keysToDelete) {
          if (Object.prototype.hasOwnProperty.call(json, key)) {
            delete json[key]
            deletedCount++
          }
        }

        if (deletedCount > 0) {
          await fs.writeFile(
            filePath,
            JSON.stringify(json, null, 2) + '\n',
            'utf8',
          )
          console.log(`Updated ${file} (removed ${deletedCount} keys)`)
        }
      }

      // Check for i18n.lock and warn
      try {
        await fs.access(path.join(projectRoot, 'i18n.lock'))
        console.log(
          '\n⚠️  Detected i18n.lock file. You may need to run your translation tool (e.g., lingo) to resync.',
        )
      } catch (e) {
        // No lock file, ignore
      }

      console.log('\n✨ Cleanup complete!')
      console.log('Run `pnpm run generate:locales` to update lib/locales.ts')
    } else {
      console.log('\nAborted.')
    }
  } else {
    console.log('\nNo keys selected. Aborted.')
  }

  rl.close()
}

run().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
