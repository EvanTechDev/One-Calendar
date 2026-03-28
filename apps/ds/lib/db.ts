import { Pool } from "pg";

export const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

export async function ensureTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar_backups (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_backups_user_id ON calendar_backups(user_id)",
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        share_id TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_user_share ON shares(user_id, share_id)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_shares_share_id ON shares(share_id)",
    );
  } finally {
    client.release();
  }
}
