import { Pool } from "pg";

const postgresUrl = process.env.POSTGRES_URL;
const useSsl =
  postgresUrl &&
  !/localhost|127\.0\.0\.1/.test(postgresUrl) &&
  !/sslmode=disable/.test(postgresUrl);

export const dsPool = new Pool({
  connectionString: postgresUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

let dsInited = false;

export async function initDsTables() {
  if (dsInited) return;
  const client = await dsPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        did TEXT NOT NULL,
        share_id TEXT NOT NULL UNIQUE,
        plain_data TEXT,
        encrypted_data TEXT,
        iv TEXT,
        auth_tag TEXT,
        timestamp TIMESTAMPTZ NOT NULL,
        is_protected BOOLEAN NOT NULL DEFAULT FALSE,
        is_burn BOOLEAN NOT NULL DEFAULT FALSE,
        enc_version INTEGER
      )
    `);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS did TEXT`);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS plain_data TEXT`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shares_did ON shares(did)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_data (
        id SERIAL PRIMARY KEY,
        did TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(did)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_data_did ON calendar_data(did)`);

    dsInited = true;
  } finally {
    client.release();
  }
}
