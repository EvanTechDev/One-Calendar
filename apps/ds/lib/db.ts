import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const sqlitePath = process.env.DS_SQLITE_PATH ?? 'ds.sqlite'

const bootstrapSql = `
CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scopes TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS authorization_codes (
  code TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`

function createSqliteClient() {
  const sqlite = new Database(sqlitePath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.exec(bootstrapSql)
  return sqlite
}

type DbClient = ReturnType<typeof drizzle>

declare global {
  // eslint-disable-next-line no-var
  var __one_calendar_ds_db__: DbClient | undefined
}

function getDbClient() {
  if (process.env.NODE_ENV === 'production') {
    return drizzle(createSqliteClient())
  }

  if (!globalThis.__one_calendar_ds_db__) {
    globalThis.__one_calendar_ds_db__ = drizzle(createSqliteClient())
  }

  return globalThis.__one_calendar_ds_db__
}

export const db = getDbClient()
