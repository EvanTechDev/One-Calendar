/**
 * In-memory fake of the drizzle surface `packages/meetings` actually uses.
 *
 * A characterization harness, NOT a database emulator: it supports exactly the
 * chainable calls these operations make and evaluates real drizzle condition
 * objects by walking them. Anything it does not recognise throws — a deliberate
 * STOP signal, so a query the fake silently mis-evaluates cannot pass a test.
 *
 * Table identity comes from the real drizzle table objects, so a test seeds and
 * asserts against `meetingSession` etc. rather than string names.
 */
import { getTableName } from 'drizzle-orm'
import type { Db } from '@zntr/meetings'

type Row = Record<string, unknown>

/** Drizzle's internal symbols for reading a column's table and name. */
function columnInfo(column: unknown): { table: string; name: string } {
  const col = column as {
    name?: string
    table?: unknown
    keyAsName?: unknown
  }
  if (typeof col?.name !== 'string' || !col.table) {
    throw new Error('fake-db: expected a drizzle column')
  }
  return { table: getTableName(col.table as never), name: col.name }
}

function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function columnKey(column: unknown): string {
  return snakeToCamel(columnInfo(column).name)
}

function compare(a: unknown, b: unknown): number {
  const av = a instanceof Date ? a.getTime() : a
  const bv = b instanceof Date ? b.getTime() : b
  if (av === bv) return 0
  // Nulls sort last, matching Postgres' default for ASC.
  if (av === null || av === undefined) return 1
  if (bv === null || bv === undefined) return -1
  return (av as number) < (bv as number) ? -1 : 1
}

function equals(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}

/** A drizzle SQL node — anything carrying `queryChunks`. */
function chunksOf(node: unknown): unknown[] | null {
  const candidate = node as { queryChunks?: unknown[] }
  return Array.isArray(candidate?.queryChunks) ? candidate.queryChunks : null
}

/** Operator/keyword text: drizzle's StringChunk, whose `value` is an array. */
function textOf(node: unknown): string | null {
  const candidate = node as { value?: unknown }
  if (!candidate || typeof candidate !== 'object') return null
  return Array.isArray(candidate.value) ? candidate.value.join('') : null
}

function isColumn(node: unknown): boolean {
  const candidate = node as { name?: unknown; table?: unknown }
  return typeof candidate?.name === 'string' && candidate.table !== undefined
}

/** Bound parameter: a wrapped `{ value }`, or a bare primitive chunk. */
function paramValues(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(paramValues)
  if (node === null) return [null]
  if (typeof node !== 'object') return [node]
  const candidate = node as { value?: unknown }
  if ('value' in candidate && !Array.isArray(candidate.value)) {
    return [candidate.value]
  }
  return []
}

/**
 * Evaluates a drizzle SQL condition against a row, recursively. Only the shapes
 * the package builds are understood; anything else throws rather than silently
 * matching everything.
 */
function matches(row: Row, condition: unknown): boolean {
  if (condition === undefined || condition === null) return true
  const chunks = chunksOf(condition)
  if (!chunks) {
    throw new Error('fake-db: unrecognised condition (no queryChunks)')
  }

  const subConditions = chunks.filter((chunk) => chunksOf(chunk) !== null)
  const columns = chunks.filter(isColumn)
  const joiner = chunks
    .map(textOf)
    .filter((text): text is string => text !== null)
    .join('')
    .toLowerCase()

  // A combinator: and()/or() nest their operands rather than naming a column.
  if (columns.length === 0) {
    if (subConditions.length === 0) {
      throw new Error(`fake-db: empty condition ("${joiner}")`)
    }
    // and(a, b) renders as [ "(", <a and b>, ")" ] — one level of wrapping.
    if (subConditions.length === 1) return matches(row, subConditions[0])
    if (joiner.includes(' and ')) {
      return subConditions.every((sub) => matches(row, sub))
    }
    if (joiner.includes(' or ')) {
      return subConditions.some((sub) => matches(row, sub))
    }
    throw new Error(`fake-db: unrecognised combinator ("${joiner}")`)
  }

  const key = columnKey(columns[0])
  const actual = row[key]
  const params = chunks
    .filter((chunk) => !isColumn(chunk) && textOf(chunk) === null)
    .flatMap(paramValues)

  if (joiner.includes(' is not null')) {
    return actual !== null && actual !== undefined
  }
  if (joiner.includes(' is null'))
    return actual === null || actual === undefined
  if (joiner.includes(' in ')) {
    // `inArray(col, subquery)` wraps the unawaited select as a single param.
    // Resolve it eagerly — the fake is synchronous underneath, so its rows are
    // already available.
    const subquery = params.find(
      (value) => typeof (value as { __rows?: unknown })?.__rows === 'function',
    ) as { __rows: () => Row[] } | undefined
    if (subquery) {
      return subquery
        .__rows()
        .some((sub) => equals(actual, Object.values(sub)[0]))
    }
    return params.some((value) => equals(actual, value))
  }
  if (joiner.includes(' ilike ')) {
    return likeMatches(String(actual ?? ''), String(params[0]))
  }
  if (joiner.includes(' <= ')) return compare(actual, params[0]) <= 0
  if (joiner.includes(' >= ')) return compare(actual, params[0]) >= 0
  if (joiner.includes(' < ')) return compare(actual, params[0]) < 0
  if (joiner.includes(' > ')) return compare(actual, params[0]) > 0
  if (joiner.includes(' = ')) return equals(actual, params[0])

  throw new Error(`fake-db: unrecognised operator in "${joiner}"`)
}

/** Case-insensitive LIKE with `\` escaping, matching Postgres' ILIKE. */
export function likeMatches(value: string, pattern: string): boolean {
  let regex = ''
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]!
    if (char === '\\') {
      const next = pattern[++i]
      if (next !== undefined)
        regex += next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      continue
    }
    if (char === '%') {
      regex += '.*'
      continue
    }
    if (char === '_') {
      regex += '.'
      continue
    }
    regex += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${regex}$`, 'i').test(value)
}

export interface FakeDb {
  db: Db
  seed(table: unknown, rows: Row[]): void
  all(table: unknown): Row[]
  reset(): void
}

export function createFakeDb(): FakeDb {
  const tables = new Map<string, Row[]>()

  const rowsOf = (table: unknown): Row[] => {
    const name = getTableName(table as never)
    const existing = tables.get(name)
    if (existing) return existing
    const created: Row[] = []
    tables.set(name, created)
    return created
  }

  /** Column defaults the schema declares, applied on insert. */
  const withDefaults = (table: unknown, values: Row): Row => {
    const name = getTableName(table as never)
    const now = new Date()
    if (name === 'meeting') {
      return {
        organiserId: null,
        creatorTokenHash: null,
        eventId: null,
        accessPolicy: 'open',
        endedAt: null,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        ...values,
      }
    }
    if (name === 'meeting_session') return { endedAt: null, ...values }
    if (name === 'meeting_attendance') return { leftAt: null, ...values }
    if (name === 'meeting_chat_message') return { sessionId: null, ...values }
    return { ...values }
  }

  const primaryKeyOf = (): string => 'id'

  const db = {
    select(projection?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          const state = {
            rows: [...rowsOf(table)],
            condition: undefined as unknown,
            order: [] as { key: string; dir: 'asc' | 'desc' }[],
            limitTo: undefined as number | undefined,
          }
          const build = (): Row[] => {
            let out = state.rows.filter((row) => matches(row, state.condition))
            for (const { key, dir } of [...state.order].reverse()) {
              out = [...out].sort(
                (a, b) => compare(a[key], b[key]) * (dir === 'desc' ? -1 : 1),
              )
            }
            if (state.limitTo !== undefined) out = out.slice(0, state.limitTo)
            if (!projection) return out
            return out.map((row) => {
              const picked: Row = {}
              for (const [alias, column] of Object.entries(projection)) {
                const { table, name } = columnInfo(column)
                const key = snakeToCamel(name)
                // A joined row keeps each source table's row under its own
                // name, so a column shadowed by another table is still
                // reachable unambiguously.
                const source = row[table] as Row | undefined
                picked[alias] = source && key in source ? source[key] : row[key]
              }
              return picked
            })
          }
          const chain = {
            /**
             * Inner joins are flattened into merged rows. The package only ever
             * joins on equality of two columns, so the join key pair is read out
             * of the condition and the cartesian product filtered on it.
             */
            innerJoin(joined: unknown, condition: unknown) {
              const columns = (chunksOf(condition) ?? []).filter(isColumn)
              if (columns.length !== 2) {
                throw new Error(
                  'fake-db: innerJoin needs a two-column equality',
                )
              }
              const [left, right] = columns
              const leftTable = columnInfo(left).table
              const joinedTable = getTableName(joined as never)
              // Whichever column belongs to the table being joined is the
              // right-hand side of the match.
              const joinedKey =
                columnInfo(left).table === joinedTable
                  ? columnKey(left)
                  : columnKey(right)
              const baseKey =
                columnInfo(left).table === joinedTable
                  ? columnKey(right)
                  : columnKey(left)
              if (
                leftTable === joinedTable &&
                columnInfo(right).table === joinedTable
              ) {
                throw new Error('fake-db: self-join is not supported')
              }

              const merged: Row[] = []
              for (const base of state.rows) {
                for (const other of rowsOf(joined)) {
                  if (!equals(base[baseKey], other[joinedKey])) continue
                  // Base columns win on collision, matching drizzle's own
                  // flat-select behaviour where each alias names one column.
                  merged.push({
                    ...other,
                    ...base,
                    // Each source row is also kept under its table name, so a
                    // projection can name a shadowed column unambiguously.
                    [joinedTable]: other,
                    [leftTable]: base,
                  })
                }
              }
              state.rows = merged
              return chain
            },
            groupBy(...columns: unknown[]) {
              const keys = columns.map(columnKey)
              const seen = new Set<string>()
              state.rows = state.rows.filter((row) => {
                const signature = keys
                  .map((key) => String(row[key]))
                  .join('\u0000')
                if (seen.has(signature)) return false
                seen.add(signature)
                return true
              })
              return chain
            },
            where(condition: unknown) {
              state.condition = condition
              return chain
            },
            orderBy(...columns: unknown[]) {
              for (const column of columns) {
                const wrapped = chunksOf(column)
                if (!wrapped) {
                  // A bare column: ascending.
                  state.order.push({ key: columnKey(column), dir: 'asc' })
                  continue
                }
                // desc(col) renders as [ "", col, " desc" ].
                const inner = wrapped.find(isColumn)
                const direction = wrapped
                  .map(textOf)
                  .filter((text): text is string => text !== null)
                  .join('')
                  .toLowerCase()
                state.order.push({
                  key: columnKey(inner),
                  dir: direction.includes('desc') ? 'desc' : 'asc',
                })
              }
              return chain
            },
            limit(count: number) {
              state.limitTo = count
              return chain
            },
            /**
             * Escape hatch for `inArray(col, <subquery>)`: drizzle passes the
             * unawaited select in as a chunk, and the evaluator resolves it
             * through this rather than awaiting.
             */
            __rows: () => build(),
            then(
              resolve: (rows: Row[]) => unknown,
              reject?: (error: unknown) => unknown,
            ) {
              try {
                return Promise.resolve(resolve(build()))
              } catch (error) {
                return reject
                  ? Promise.resolve(reject(error))
                  : Promise.reject(error)
              }
            },
          }
          return chain
        },
      }
    },

    insert(table: unknown) {
      return {
        values(values: Row) {
          const store = rowsOf(table)
          const key = primaryKeyOf()
          let inserted: Row | null = null
          let conflicted = false
          const apply = () => {
            if (inserted !== null || conflicted) return
            const row = withDefaults(table, values)
            if (store.some((existing) => existing[key] === row[key])) {
              conflicted = true
              return
            }
            store.push(row)
            inserted = row
          }
          const chain = {
            onConflictDoNothing() {
              apply()
              return chain
            },
            returning() {
              apply()
              return Promise.resolve(inserted ? [inserted] : [])
            },
            then(
              resolve: (rows: Row[]) => unknown,
              reject?: (error: unknown) => unknown,
            ) {
              try {
                apply()
                if (conflicted && inserted === null) {
                  // Without onConflictDoNothing a duplicate key is an error,
                  // exactly as Postgres would raise.
                  throw new Error('fake-db: duplicate key')
                }
                return Promise.resolve(resolve(inserted ? [inserted] : []))
              } catch (error) {
                return reject
                  ? Promise.resolve(reject(error))
                  : Promise.reject(error)
              }
            },
          }
          return chain
        },
      }
    },

    update(table: unknown) {
      return {
        set(patch: Row) {
          const chain = {
            where(condition: unknown) {
              for (const row of rowsOf(table)) {
                if (matches(row, condition)) Object.assign(row, patch)
              }
              return Promise.resolve([])
            },
          }
          return chain
        },
      }
    },

    delete(table: unknown) {
      return {
        where(condition: unknown) {
          const store = rowsOf(table)
          const removed: Row[] = []
          for (let i = store.length - 1; i >= 0; i--) {
            if (matches(store[i]!, condition)) {
              removed.unshift(...store.splice(i, 1))
            }
          }
          const chain = {
            returning() {
              return Promise.resolve(removed)
            },
            then(resolve: (rows: Row[]) => unknown) {
              return Promise.resolve(resolve(removed))
            },
          }
          return chain
        },
      }
    },
  }

  return {
    db: db as unknown as Db,
    seed(table: unknown, rows: Row[]) {
      for (const row of rows) rowsOf(table).push(withDefaults(table, row))
    },
    all(table: unknown) {
      return [...rowsOf(table)]
    },
    reset() {
      tables.clear()
    },
  }
}
