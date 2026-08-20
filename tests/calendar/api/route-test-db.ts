/**
 * In-memory fake of the drizzle query surface used by the events REST route
 * and the MCP event tools. It is a characterization-test harness, NOT a
 * database emulator: it supports exactly the chainable calls those two files
 * make (select/insert/update/delete + where/returning/orderBy/limit/
 * onConflictDoUpdate) and evaluates only the plain-object conditions produced
 * by `drizzleOperatorsMock` below. Any unknown condition shape throws — that
 * is a deliberate STOP signal, not a bug to silence.
 *
 * Test files must mock the `drizzle-orm` module with `drizzleOperatorsMock`
 * (spread over the real module so `relations` etc. keep working) and mock
 * `@/lib/drizzle/client`'s `getDb` to return `getFakeDb().db`.
 */

type FakeRow = Record<string, unknown>

type Cond =
  | { __op: 'eq'; col: string; val: unknown }
  | { __op: 'and'; conds: Cond[] }
  | { __op: 'or'; conds: Cond[] }
  | { __op: 'inArray'; col: string; vals: unknown[] }
  | { __op: 'isNotNull'; col: string }
  | { __op: 'gte'; col: string; val: unknown }
  | { __op: 'lte'; col: string; val: unknown }
  | { __op: 'gt'; col: string; val: unknown }
  | { __op: 'lt'; col: string; val: unknown }

type DrizzleColumn = { name: string }

function camelize(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function colKey(col: unknown): string {
  const name = (col as DrizzleColumn)?.name
  if (typeof name !== 'string') {
    throw new Error('fake-db: expected a drizzle column object')
  }
  return camelize(name)
}

/**
 * Plain-object builders replacing drizzle-orm's SQL operators. Spread these
 * over the real module inside `vi.mock('drizzle-orm', …)`.
 */
export const drizzleOperatorsMock = {
  eq: (col: unknown, val: unknown): Cond => ({
    __op: 'eq',
    col: colKey(col),
    val,
  }),
  and: (...conds: (Cond | undefined)[]): Cond => ({
    __op: 'and',
    conds: conds.filter(Boolean) as Cond[],
  }),
  or: (...conds: (Cond | undefined)[]): Cond => ({
    __op: 'or',
    conds: conds.filter(Boolean) as Cond[],
  }),
  inArray: (col: unknown, vals: unknown[]): Cond => ({
    __op: 'inArray',
    col: colKey(col),
    vals,
  }),
  isNotNull: (col: unknown): Cond => ({ __op: 'isNotNull', col: colKey(col) }),
  gte: (col: unknown, val: unknown): Cond => ({
    __op: 'gte',
    col: colKey(col),
    val,
  }),
  lte: (col: unknown, val: unknown): Cond => ({
    __op: 'lte',
    col: colKey(col),
    val,
  }),
  gt: (col: unknown, val: unknown): Cond => ({
    __op: 'gt',
    col: colKey(col),
    val,
  }),
  lt: (col: unknown, val: unknown): Cond => ({
    __op: 'lt',
    col: colKey(col),
    val,
  }),
  desc: (col: unknown) => ({ __order: 'desc', col: colKey(col) }),
}

function matches(cond: Cond | undefined, row: FakeRow): boolean {
  if (cond === undefined) return true
  switch (cond.__op) {
    case 'eq':
      return row[cond.col] === cond.val
    case 'and':
      return cond.conds.every((c) => matches(c, row))
    case 'or':
      return cond.conds.some((c) => matches(c, row))
    case 'inArray':
      return cond.vals.includes(row[cond.col])
    case 'isNotNull':
      return row[cond.col] !== null && row[cond.col] !== undefined
    case 'gte':
      return (row[cond.col] as never) >= (cond.val as never)
    case 'lte':
      return (row[cond.col] as never) <= (cond.val as never)
    case 'gt':
      return (row[cond.col] as never) > (cond.val as never)
    case 'lt':
      return (row[cond.col] as never) < (cond.val as never)
    default:
      throw new Error('fake-db: unsupported condition')
  }
}

function tableName(table: unknown): string {
  // drizzle pg tables carry their SQL name under a well-known symbol.
  for (const sym of Object.getOwnPropertySymbols(table as object)) {
    if (sym.description === 'drizzle:Name') {
      return (table as Record<symbol, string>)[sym]
    }
  }
  throw new Error('fake-db: not a drizzle table')
}

function project(
  row: FakeRow,
  projection: Record<string, unknown> | undefined,
): FakeRow {
  if (!projection) return { ...row }
  const out: FakeRow = {}
  for (const [alias, col] of Object.entries(projection)) {
    out[alias] = row[colKey(col)]
  }
  return out
}

export interface FakeDb {
  db: Record<string, unknown>
  ops: string[]
  /** Structured mirror of `ops` for asserting on written fields. */
  writes: Array<{
    op: 'insert' | 'update' | 'delete'
    table: string
    id: string
    data?: Record<string, unknown>
  }>
  seed: (row: FakeRow, table?: string) => void
  rows: (table?: string) => FakeRow[]
  row: (id: string, table?: string) => FakeRow | undefined
  reset: () => void
}

const DEFAULT_TABLE = 'calendar_events'

export function makeFakeDb(): FakeDb {
  const tables = new Map<string, Map<string, FakeRow>>()
  const ops: string[] = []
  const writes: FakeDb['writes'] = []

  function tbl(name: string): Map<string, FakeRow> {
    let t = tables.get(name)
    if (!t) {
      t = new Map()
      tables.set(name, t)
    }
    return t
  }

  function logWrite(
    op: 'insert' | 'update' | 'delete',
    table: string,
    id: string,
    data?: Record<string, unknown>,
  ) {
    ops.push(`${op}:${table}:id=${id}`)
    writes.push({ op, table, id, data })
  }

  function selectQuery(
    name: string,
    projection: Record<string, unknown> | undefined,
  ) {
    let cond: Cond | undefined
    const resolveRows = () =>
      [...tbl(name).values()]
        .filter((r) => matches(cond, r))
        .map((r) => project(r, projection))
    const q = {
      where(c: Cond) {
        cond = c
        return q
      },
      orderBy() {
        return q
      },
      limit() {
        return q
      },
      then(
        onFulfilled: (rows: FakeRow[]) => unknown,
        onRejected?: (err: unknown) => unknown,
      ) {
        return Promise.resolve().then(resolveRows).then(onFulfilled, onRejected)
      },
    }
    return q
  }

  const db = {
    select(projection?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          return selectQuery(tableName(table), projection)
        },
      }
    },

    insert(table: unknown) {
      const name = tableName(table)
      return {
        values(values: FakeRow) {
          const doInsert = () => {
            const id = values.id as string
            tbl(name).set(id, { ...values })
            logWrite('insert', name, id, { ...values })
            return [{ ...values }]
          }
          return {
            returning: async () => doInsert(),
            then(
              onFulfilled: (rows: FakeRow[]) => unknown,
              onRejected?: (err: unknown) => unknown,
            ) {
              return Promise.resolve()
                .then(doInsert)
                .then(onFulfilled, onRejected)
            },
            onConflictDoUpdate(conflict: { target: unknown; set: FakeRow }) {
              const doUpsert = () => {
                const id = values.id as string
                const existing = tbl(name).get(id)
                if (existing) {
                  Object.assign(existing, conflict.set)
                  logWrite('update', name, id, { ...conflict.set })
                  return [{ ...existing }]
                }
                return doInsert()
              }
              return {
                returning: async () => doUpsert(),
                then(
                  onFulfilled: (rows: FakeRow[]) => unknown,
                  onRejected?: (err: unknown) => unknown,
                ) {
                  return Promise.resolve()
                    .then(doUpsert)
                    .then(onFulfilled, onRejected)
                },
              }
            },
          }
        },
      }
    },

    update(table: unknown) {
      const name = tableName(table)
      return {
        set(values: FakeRow) {
          return {
            where(cond: Cond) {
              const doUpdate = () => {
                const updated: FakeRow[] = []
                for (const row of tbl(name).values()) {
                  if (!matches(cond, row)) continue
                  Object.assign(row, values)
                  logWrite('update', name, row.id as string, { ...values })
                  updated.push({ ...row })
                }
                return updated
              }
              return {
                returning: async () => doUpdate(),
                then(
                  onFulfilled: (rows: FakeRow[]) => unknown,
                  onRejected?: (err: unknown) => unknown,
                ) {
                  return Promise.resolve()
                    .then(doUpdate)
                    .then(onFulfilled, onRejected)
                },
              }
            },
          }
        },
      }
    },

    delete(table: unknown) {
      const name = tableName(table)
      return {
        where(cond: Cond) {
          const doDelete = () => {
            for (const [id, row] of [...tbl(name).entries()]) {
              if (!matches(cond, row)) continue
              tbl(name).delete(id)
              logWrite('delete', name, id)
            }
          }
          return {
            then(
              onFulfilled: (value: void) => unknown,
              onRejected?: (err: unknown) => unknown,
            ) {
              return Promise.resolve()
                .then(doDelete)
                .then(onFulfilled, onRejected)
            },
          }
        },
      }
    },
  }

  /**
   * Records tx boundaries in the op log and passes the SAME fake object to
   * the callback so ops inside keep logging in order. Does not simulate
   * rollback (ops stay applied); on callback throw it logs 'tx:rollback'
   * and rethrows.
   */
  async function transaction<T>(
    cb: (tx: Record<string, unknown>) => Promise<T>,
  ): Promise<T> {
    ops.push('tx:begin')
    try {
      const result = await cb(dbWithTx)
      ops.push('tx:commit')
      return result
    } catch (err) {
      ops.push('tx:rollback')
      throw err
    }
  }
  const dbWithTx: Record<string, unknown> = { ...db, transaction }

  return {
    db: dbWithTx,
    ops,
    writes,
    seed(row, table = DEFAULT_TABLE) {
      tbl(table).set(row.id as string, { ...row })
    },
    rows(table = DEFAULT_TABLE) {
      return [...tbl(table).values()].map((r) => ({ ...r }))
    },
    row(id, table = DEFAULT_TABLE) {
      const r = tbl(table).get(id)
      return r ? { ...r } : undefined
    },
    reset() {
      tables.clear()
      ops.length = 0
      writes.length = 0
    },
  }
}

/** Singleton accessor so `vi.mock` factories can hand the route a stable db. */
let shared: FakeDb | null = null

export function getFakeDb(): FakeDb {
  if (!shared) shared = makeFakeDb()
  return shared
}
