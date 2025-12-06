// server/db.ts

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// Make SSL non-strict for ALL pg clients (sessions, drizzle, anything using pg)
pg.defaults.ssl = {
  rejectUnauthorized: false,
};

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Connection pool for Supabase (Postgres)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // small pool is fine
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // no need to repeat ssl here; pg.defaults.ssl already set above
});

// Drizzle DB using node-postgres adapter
export const db = drizzle(pool, { schema });
