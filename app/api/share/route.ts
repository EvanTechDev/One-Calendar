import { type NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        share_id VARCHAR(255) NOT NULL,
        data TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        UNIQUE(share_id)
      )
    `);
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('POSTGRES_URL:', process.env.POSTGRES_URL);
    console.log('SSL Config:', { ssl: { rejectUnauthorized: false } });
    const body = await request.json();
    const { id, data } = body;
    if (!id || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not set");
    }

    await initializeDatabase();

    const dataString = typeof data === "string" ? data : JSON.stringify(data);

    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO shares (share_id, data, timestamp)
        VALUES ($1, $2, $3)
        ON CONFLICT (share_id)
        DO UPDATE SET
          data = EXCLUDED.data,
          timestamp = EXCLUDED.timestamp
      `, [id, dataString, new Date().toISOString()]);

      return NextResponse.json({
        success: true,
        path: `shares/${id}/data.json`,
        id: id,
        message: "Share created successfully."
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Share API error:", error, error instanceof Error ? error.stack : '');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('POSTGRES_URL:', process.env.POSTGRES_URL); 
    console.log('SSL Config:', { ssl: { rejectUnauthorized: false } });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }

    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not set");
    }

    await initializeDatabase();

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT data, timestamp FROM shares WHERE share_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Share not found" }, { status: 404 });
      }

      const { data, timestamp } = result.rows[0];
      return NextResponse.json({ success: true, data, timestamp: timestamp.toISOString() });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Share API error:", error, error instanceof Error ? error.stack : '');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('POSTGRES_URL:', process.env.POSTGRES_URL);
    console.log('SSL Config:', { ssl: { rejectUnauthorized: false } });
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing share ID" }, { status: 400 });
    }

    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) {
      throw new Error("POSTGRES_URL is not set");
    }

    await initializeDatabase();

    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM shares WHERE share_id = $1 RETURNING *',
        [id]
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ 
          success: true, 
          message: `No share found with ID: ${id}, nothing to delete.` 
        });
      }

      return NextResponse.json({
        success: true,
        message: `Successfully deleted share with ID: ${id}`,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Share API error:", error, error instanceof Error ? error.stack : '');
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
