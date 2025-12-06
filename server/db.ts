// server/db.ts

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Connection pool for Supabase
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // small pool is fine
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Supabase requires SSL from hosted environments like Northflank
  ssl: { rejectUnauthorized: false },
});

// Drizzle DB using node-postgres adapter
export const db = drizzle(pool, { schema });
