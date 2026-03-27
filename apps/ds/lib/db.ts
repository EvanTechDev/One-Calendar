import { Pool } from "pg";

const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  throw new Error("POSTGRES_URL is required for DS");
}

export const pool = new Pool({
  connectionString: postgresUrl,
  ssl: /localhost|127\.0\.0\.1/.test(postgresUrl) ? undefined : { rejectUnauthorized: false },
});

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        did TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shares_did ON shares(did)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_data (
        id TEXT PRIMARY KEY,
        did TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_data_did ON calendar_data(did)`);
  } finally {
    client.release();
  }
}
