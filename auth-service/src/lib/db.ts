import { Pool } from "pg";

// Единый пул соединений к Postgres. Better Auth и наши запросы используют его.
const globalForPg = globalThis as unknown as { __pgPool?: Pool };

export const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Большинство managed-Postgres (Neon/Supabase) требуют SSL.
    ssl: process.env.DATABASE_URL?.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForPg.__pgPool = pool;
