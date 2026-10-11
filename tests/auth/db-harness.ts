import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

type Row = Record<string, unknown>

/**
 * A tagged-template query handle over one node-postgres client.
 *
 * Interpolated values become bind parameters, never SQL text; `unsafe` runs a
 * raw (possibly multi-statement) script through the simple query protocol.
 * Every statement goes out inside a transaction that pins the search path to
 * the test schema, so the confinement holds however the database is pooled.
 */
export interface Sql {
  <T extends readonly Row[] = Row[]>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>
  unsafe(text: string): Promise<Row[]>
  end(): Promise<void>
  /**
   * A client that cannot issue an unpinned statement. Hand THIS to anything
   * that takes a `pg.Client` — drizzle, in particular — rather than trusting
   * each call site to remember.
   */
  readonly client: pg.Client
}

/**
 * Runs `statement` with the search path pinned to the test schema, on a backend
 * this connection holds for its whole duration.
 *
 * A `SET search_path` on its own is a SESSION setting, and under a
 * transaction-mode pooler the session belongs to the backend rather than to the
 * connection: the pooler releases the backend between statements and hands it
 * to whoever asks next, so a sibling client's `set search_path to public`
 * silently rewrites ours between two of our own statements. `set LOCAL` scopes
 * the value to a transaction, and holding a transaction is what pins the
 * backend — so this is the one construct a transaction pooler cannot take away.
 *
 * Costs three round trips per statement (prelude, statement, commit) against
 * one for a bare query. That is the price of isolation on a pooled connection,
 * and it is only paid by integration tests.
 */
async function inPinnedTransaction<T>(
  client: pg.Client,
  statement: () => Promise<T>,
): Promise<T> {
  // One round trip for the prelude. `search_path` is a fixed identifier, not
  // user input, so it is safe to interpolate.
  await client.query(`begin; set local search_path to ${TEST_SCHEMA}`)
  try {
    const result = await statement()
    await client.query('commit')
    return result
  } catch (error) {
    // A failed statement aborts the transaction, which `commit` would then
    // report as an error of its own. Roll back and surface the real cause.
    await client.query('rollback').catch(() => {})
    throw error
  }
}

/**
 * A `pg.Client` that cannot issue an unpinned statement.
 *
 * Applied at the client boundary rather than at the call site, because call
 * sites are not the only callers: `drizzle({ client })` holds the client
 * itself and would otherwise query outside everything this file guarantees.
 * Anything handed this handle is confined, including code that was never
 * written with the test schema in mind.
 *
 * Concurrent callers are serialised, and that is load-bearing rather than
 * tidiness. node-postgres queues every statement a client issues, so two
 * overlapping transactions interleave as `begin, begin, statement, commit`:
 * the second `begin` is a no-op, the first `commit` ends the transaction early,
 * and the second statement — the one the second caller is waiting on — runs
 * with no pin at all. A test firing twenty concurrent upserts is exactly how
 * that happens, and the result is a query that quietly reaches `public`.
 */
function pinToTestSchema(client: pg.Client): pg.Client {
  let tail: Promise<unknown> = Promise.resolve()
  return new Proxy(client, {
    get(target, property) {
      if (property === 'query') {
        // The promise form only. node-postgres also accepts a callback, which
        // cannot be bridged into a transaction without changing its timing, so
        // refusing it is better than silently running it outside the pin.
        return (config: never, values?: never) => {
          const run = () =>
            inPinnedTransaction(target, () =>
              values === undefined
                ? target.query(config)
                : target.query(config, values),
            )
          const result = tail.then(run, run)
          // The chain must survive a rejection, or one failed statement would
          // wedge every later one behind it.
          tail = result.then(
            () => undefined,
            () => undefined,
          )
          return result
        }
      }
      // Bound to the real client, so `this` inside node-postgres' own methods
      // stays the object holding the connection state.
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function wrapClient(client: pg.Client): Sql {
  const pinned = pinToTestSchema(client)
  const query = async <T extends readonly Row[]>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T> => {
    const text = strings.reduce((acc, part, index) => `${acc}$${index}${part}`)
    const result = await pinned.query(text, values)
    return result.rows as unknown as T
  }
  return Object.assign(query, {
    async unsafe(text: string) {
      const result = await pinned.query(text)
      // A multi-statement script yields one result per statement.
      const last = Array.isArray(result) ? result.at(-1) : result
      return (last?.rows ?? []) as Row[]
    },
    end: () => client.end(),
    client: pinned,
  })
}

/**
 * A real Postgres connection for the auth integration tests, pinned to an
 * isolated schema.
 *
 * Plan 026 Seam 2 needs a real database rather than a fake: the tests exist to
 * check OAuth protocol conformance, and a hand-written fake would encode our
 * assumptions instead of the server's behaviour — which is precisely the thing
 * under test.
 *
 * The project database also holds real users in `public`. So isolation is not
 * hygiene here, it is the safety property: every helper below refuses to run
 * until it has proved the connection cannot see `public`. A harness that could
 * reach `public` is a defect in the harness, not an inconvenience.
 *
 * The isolation is applied at the client boundary, not at the call sites,
 * because call sites are not the only callers — see `pinToTestSchema`. That also
 * means it survives the pooling mode of whatever server is configured, which a
 * session-level `search_path` would not: the pooler the app itself uses is
 * transaction mode, where a session setting belongs to the backend and any
 * sibling connection can rewrite it.
 */

/** The only schema these tests may touch. */
export const TEST_SCHEMA = 'auth_test'

/** Tables that must never be visible to a test connection. */
const FORBIDDEN_TABLES = ['user', 'session', 'account', 'verification']

function readDatabaseUrl(): string | null {
  // Read from .env.local rather than process.env: vitest does not load it, and
  // an explicitly-passed env var is the documented override.
  if (process.env.AUTH_TEST_POSTGRES_URL) {
    return process.env.AUTH_TEST_POSTGRES_URL
  }
  const envPath = path.resolve(import.meta.dirname, '../../.env.local')
  if (!fs.existsSync(envPath)) return null
  const contents = fs.readFileSync(envPath, 'utf8')
  // `AUTH_TEST_POSTGRES_URL` first, and read from the file as well as the
  // environment: these tests create and TRUNCATE a schema, so a contributor
  // needs a way to aim them at a disposable database that is not the one the
  // app is pointed at, and the natural place to record that is the same file as
  // the URL it overrides. It is an override rather than a requirement — the
  // confinement below holds on a transaction pooler, which is the mode the app
  // itself uses.
  for (const key of ['AUTH_TEST_POSTGRES_URL', 'POSTGRES_URL']) {
    const match = contents.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'))
    if (match) return match[1]!
  }
  return null
}

function connectionConfig(): pg.ClientConfig | null {
  const url = readDatabaseUrl()
  if (!url) return null

  const disableTLS = process.env.AUTH_TEST_POSTGRES_SSL === 'disable'
  if (
    disableTLS &&
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
  ) {
    throw new Error(
      'Disabling database TLS is only supported for a local test server',
    )
  }

  const connectionUrl = new URL(url)
  // URL ssl parameters would replace the `ssl` option below.
  for (const param of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl']) {
    connectionUrl.searchParams.delete(param)
  }

  return {
    connectionString: connectionUrl.toString(),
    ssl: disableTLS ? false : { rejectUnauthorized: false },
    // Integration tests should fail fast rather than hang a suite.
    connectionTimeoutMillis: 20_000,
    // A transaction-mode pooler assigns backends per transaction, so a
    // statement can wait indefinitely for one that never comes — and
    // `connectionTimeoutMillis` does not cover that, because the connection is
    // already established. Without this the suite's own hook timeout is the
    // only thing that ends it, and the failure names the hook rather than the
    // statement. 20s is three orders of magnitude above a warm round trip
    // (~0.5s here) and the pin costs three of them per statement.
    query_timeout: 20_000,
  }
}

/**
 * Whether these tests can run at all.
 *
 * Reported rather than thrown so a contributor without database access sees
 * skipped integration tests instead of a wall of failures — but never so that a
 * missing database silently reduces coverage to nothing. The suite states the
 * skip loudly.
 */
export function databaseIsAvailable(): boolean {
  return readDatabaseUrl() !== null
}

/**
 * Asserts a connection is confined to the test schema.
 *
 * Every statement issued through `sql` is already pinned, so this reads the
 * state those statements actually run against: the checks cannot be failed by
 * poisoning the session, and a check that cannot be made to fail proves nothing
 * about the mechanism. What it does catch is the mechanism regressing — a prelude
 * that grows `public`, a server that resolves a name some other way, a
 * `search_path` that picks up an entry from the connection's own defaults.
 * `assertConfinedTo` is how the checks themselves are shown to have teeth.
 *
 * The three checks, and why each is insufficient alone:
 *
 * 1. `current_schema()` is the test schema — proves writes land there.
 * 2. The effective `search_path` names ONLY the test schema — proves nothing
 *    else is reachable unqualified, whatever this schema happens to contain.
 * 3. No forbidden table name resolves outside the test schema — a direct check
 *    on the property we actually care about.
 *
 * Check 2 is the load-bearing one, and it has to be separate from check 3. Once
 * this schema holds its own `account` replica (which is how a migration gets
 * rehearsed), a `search_path` of `auth_test, public` resolves `account` to the
 * replica — so check 3 passes while every OTHER real table is still one
 * unqualified `select` away. Inspecting the path itself does not have that blind
 * spot.
 *
 * Check 3 compares the resolved relation's SCHEMA rather than merely whether the
 * name resolves, so a legitimate replica is not mistaken for the real table.
 */
export async function assertIsolated(sql: Sql): Promise<void> {
  const [schema] = await sql<{ current_schema: string | null }[]>`
    select current_schema() as current_schema
  `
  if (schema?.current_schema !== TEST_SCHEMA) {
    throw new Error(
      `auth test harness is not isolated: current_schema is ${
        schema?.current_schema ?? 'null'
      }, expected ${TEST_SCHEMA}`,
    )
  }

  const [path] = await sql<{ search_path: string }[]>`
    show search_path
  `
  assertPathNamesOnlyTestSchema(path?.search_path ?? '')

  for (const table of FORBIDDEN_TABLES) {
    const [resolved] = await sql<{ resolved_schema: string | null }[]>`
      select n.nspname as resolved_schema
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.oid = to_regclass(${table})
    `
    const schemaName = resolved?.resolved_schema ?? null
    if (schemaName !== null && schemaName !== TEST_SCHEMA) {
      throw new Error(
        `auth test harness resolves "${table}" to schema "${schemaName}"; ` +
          `search_path must expose only ${TEST_SCHEMA}`,
      )
    }
  }
}

function assertPathNamesOnlyTestSchema(searchPath: string): void {
  const entries = searchPath
    .split(',')
    .map((entry) => entry.trim().replace(/^"|"$/g, ''))
    .filter((entry) => entry.length > 0)
  const unexpected = entries.filter((entry) => entry !== TEST_SCHEMA)
  if (unexpected.length > 0) {
    throw new Error(
      `auth test harness search_path exposes ${unexpected.join(', ')}; ` +
        `it must name only ${TEST_SCHEMA}`,
    )
  }
}

/**
 * The same three checks, against an explicit search path.
 *
 * Takes a RAW client and pins the path itself, for two reasons that pull the
 * same way. The path is part of what is being checked, so the checks cannot run
 * through the harness's own pinned handle without checking a tautology. And one
 * transaction has to span both the pin and the checks: `set local` is
 * transaction-scoped, so pinning in one transaction and inspecting in the next
 * would inspect whatever the backend happened to be carrying.
 *
 * Tests pass a deliberately leaky path to show these checks catch one.
 */
export async function assertConfinedTo(
  client: pg.Client,
  schemas: readonly string[],
): Promise<void> {
  for (const schema of schemas) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) {
      throw new Error(`refusing to search a path named "${schema}"`)
    }
  }
  const path = schemas.length > 0 ? schemas.join(', ') : '""'
  await client.query(`begin; set local search_path to ${path}`)
  try {
    const current = (
      await client.query('select current_schema() as current_schema')
    ).rows[0] as { current_schema: string | null } | undefined
    if (current?.current_schema !== TEST_SCHEMA) {
      throw new Error(
        `auth test harness is not isolated: current_schema is ${
          current?.current_schema ?? 'null'
        }, expected ${TEST_SCHEMA}`,
      )
    }

    const shown = (await client.query('show search_path')).rows[0] as
      | { search_path: string }
      | undefined
    assertPathNamesOnlyTestSchema(shown?.search_path ?? '')

    for (const table of FORBIDDEN_TABLES) {
      const resolved = (
        await client.query(
          'select n.nspname as resolved_schema from pg_class c ' +
            'join pg_namespace n on n.oid = c.relnamespace ' +
            `where c.oid = to_regclass('${table}')`,
        )
      ).rows[0] as { resolved_schema: string | null } | undefined
      const schemaName = resolved?.resolved_schema ?? null
      if (schemaName !== null && schemaName !== TEST_SCHEMA) {
        throw new Error(
          `auth test harness resolves "${table}" to schema "${schemaName}"; ` +
            `search_path must expose only ${TEST_SCHEMA}`,
        )
      }
    }
  } finally {
    await client.query('rollback').catch(() => {})
  }
}

/**
 * A connection to the same database with NO isolation whatsoever.
 *
 * Exists so the confinement checks can be pointed at a path that leaks. The
 * harness's own path is pinned, so it cannot be made to fail them, and a guard
 * that has never rejected anything is untested. Test code should not query
 * through this handle: an unpinned statement is precisely the accident this
 * file exists to prevent.
 */
export async function connectUnpinned(): Promise<pg.Client | null> {
  const config = connectionConfig()
  if (!config) return null
  const client = new pg.Client(config)
  await client.connect()
  return client
}

/**
 * Opens an isolated connection, or returns null when no database is configured.
 *
 * Nothing is set up front: the handle returned already pins every statement to
 * the test schema, which is what the isolation actually consists of. `public` is
 * excluded from the path deliberately — Postgres resolves unqualified names
 * against the path alone, so a stray query fails to find a real table rather
 * than finding one.
 */
export async function connectIsolated(): Promise<Sql | null> {
  const config = connectionConfig()
  if (!config) return null

  const client = new pg.Client(config)
  await client.connect()
  const sql = wrapClient(client)

  try {
    await assertIsolated(sql)
  } catch (error) {
    await sql.end()
    throw error
  }

  return sql
}

/**
 * Empties one named table the caller owns.
 *
 * Deliberately NOT a whole-schema truncate. Suites run in parallel against a
 * single schema, so emptying everything would delete another suite's fixtures
 * mid-run and produce failures unrelated to the code under test.
 *
 * Re-asserts isolation first, and rejects a qualified name. Truncation is the
 * one operation where a misconfigured connection is catastrophic rather than
 * merely wrong, so the check is repeated here rather than trusted from setup,
 * and a caller cannot reach outside the test schema by passing `public.user`.
 */
export async function truncateOwn(sql: Sql, table: string): Promise<void> {
  await assertIsolated(sql)

  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
    throw new Error(
      `refusing to truncate "${table}": pass a bare table name in ${TEST_SCHEMA}`,
    )
  }

  await sql.unsafe(`truncate table ${TEST_SCHEMA}."${table}" cascade`)
}
