import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const config = JSON.parse(readFileSync(new URL('i18n.json', root), 'utf8'))
const errors = []
const placeholders = (value) =>
  (value.match(/\{\{?[A-Za-z0-9_]+\}?\}|%[sd]/g) ?? []).sort().join('|')

function validate(path, original, value) {
  if (Array.isArray(original)) {
    if (!Array.isArray(value) || value.length !== original.length) {
      errors.push(`${path}: translation array length differs`)
      return
    }
    original.forEach((item, index) =>
      validate(`${path}[${index}]`, item, value[index]),
    )
    return
  }
  if (original !== null && typeof original === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path}: missing translation object`)
      return
    }
    for (const [key, item] of Object.entries(original)) {
      validate(`${path}/${key}`, item, value[key])
    }
    return
  }
  if (typeof original !== 'string') {
    if (value !== original) errors.push(`${path}: non-text value differs`)
    return
  }
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path}: missing translation`)
    return
  }
  if (placeholders(original) !== placeholders(value)) {
    errors.push(`${path}: placeholders differ`)
  }
  for (const literal of [
    'Zentra Calendar',
    'Zentra Meet',
    'DELETE MY ACCOUNT',
  ]) {
    if (original.includes(literal) && !value.includes(literal)) {
      errors.push(`${path}: required literal ${literal} changed`)
    }
  }
}

for (const pattern of config.buckets.json.include) {
  const readLocale = (locale) =>
    JSON.parse(
      readFileSync(new URL(pattern.replace('[locale]', locale), root), 'utf8'),
    )
  const source = readLocale(config.locale.source)
  for (const locale of config.locale.targets) {
    validate(locale, source, readLocale(locale))
  }
  console.log(
    `Checked ${Object.keys(source).length} keys across ${config.locale.targets.length} locales`,
  )
}
if (errors.length) throw new Error(errors.join('\n'))
console.log('Translation keys, placeholders and protected names are complete')
