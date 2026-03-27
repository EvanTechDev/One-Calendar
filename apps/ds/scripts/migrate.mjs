import pg from "pg";

const url = process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL is required");

const pool = new pg.Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
});

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
  console.log("ds migration completed");
} finally {
  client.release();
  await pool.end();
}
