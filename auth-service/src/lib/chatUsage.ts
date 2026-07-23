import { pool } from "./db";

const limit = () => Math.max(1, Number(process.env.CHAT_DAILY_LIMIT ?? "4") || 4);

async function ensureChatUsageSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_usage (
      user_id text NOT NULL,
      day date NOT NULL,
      count integer NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    )
  `);
}

export async function getChatRemaining(userId: string): Promise<number> {
  await ensureChatUsageSchema();
  const { rows } = await pool.query(
    `SELECT count FROM chat_usage
     WHERE user_id = $1 AND day = (now() AT TIME ZONE 'utc')::date`,
    [userId],
  );
  return Math.max(0, limit() - Number(rows[0]?.count ?? 0));
}

export async function consumeChatRequest(userId: string): Promise<number | null> {
  await ensureChatUsageSchema();
  const dailyLimit = limit();
  const { rows } = await pool.query(
    `INSERT INTO chat_usage (user_id, day, count)
     VALUES ($1, (now() AT TIME ZONE 'utc')::date, 1)
     ON CONFLICT (user_id, day) DO UPDATE
       SET count = chat_usage.count + 1
       WHERE chat_usage.count < $2
     RETURNING count`,
    [userId, dailyLimit],
  );
  if (!rows.length) return null;
  return Math.max(0, dailyLimit - Number(rows[0].count));
}
