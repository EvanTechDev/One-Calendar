import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL!;
const client = postgres(connectionString, {
  prepare: false, // Recommended for some serverless environments/poolers
});

export const db = drizzle(client, { schema });
