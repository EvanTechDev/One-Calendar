import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const config = JSON.parse(readFileSync(new URL('i18n.json', root), 'utf8'))
const errors = []
const placeholders = (value) =>
  (value.match(/\{\{?[A-Za-z0-9_]+\}?\}|%[sd]/g) ?? []).sort().join('|')

for (const pattern of config.buckets.json.include) {
  const readLocale = (locale) =>
    JSON.parse(
      readFileSync(new URL(pattern.replace('[locale]', locale), root), 'utf8'),
    )
  const source = readLocale(config.locale.source)
  for (const locale of config.locale.targets) {
    const translated = readLocale(locale)
    for (const [key, original] of Object.entries(source)) {
      const value = translated[key]
      if (typeof value !== 'string' || !value.trim()) {
        errors.push(`${locale}/${key}: missing translation`)
        continue
      }
      if (placeholders(original) !== placeholders(value)) {
        errors.push(`${locale}/${key}: placeholders differ`)
      }
      for (const literal of [
        'Zentra Calendar',
        'Zentra Meet',
        'DELETE MY ACCOUNT',
      ]) {
        if (original.includes(literal) && !value.includes(literal)) {
          errors.push(`${locale}/${key}: required literal ${literal} changed`)
        }
      }
    }
  }
  console.log(
    `Checked ${Object.keys(source).length} keys across ${config.locale.targets.length} locales`,
  )
}
if (errors.length) throw new Error(errors.join('\n'))
console.log('Translation keys, placeholders and protected names are complete')
