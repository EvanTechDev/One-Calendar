import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes("localhost") ? false : { rejectUnauthorized: false }
});

const queries = [
  `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, did TEXT NOT NULL, payload_ciphertext TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, did TEXT NOT NULL, ciphertext TEXT NOT NULL, metadata_ciphertext TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS calendar_backups (id TEXT PRIMARY KEY, did TEXT NOT NULL, ciphertext TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_events_did ON events (did)`,
  `CREATE INDEX IF NOT EXISTS idx_shares_did ON shares (did)`,
  `CREATE INDEX IF NOT EXISTS idx_backups_did ON calendar_backups (did)`
];

const client = await pool.connect();
try {
  for (const query of queries) await client.query(query);
  process.stdout.write("migration complete\n");
} finally {
  client.release();
  await pool.end();
}
