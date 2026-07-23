import { randomBytes } from "crypto";
import { pool } from "./db";

/**
 * Одноразовые коды для веб→десктоп хендоффа входа.
 *
 * Поток: десктоп открывает веб-вход (/app/start → Google или уже готовая сессия
 * с лендинга) → /app/complete мятит короткоживущий код и возвращает его в
 * приложение по deep-link `siplinx://auth?code=...` → десктоп меняет код на
 * bearer-токен через POST /api/app/exchange. Токен в deep-link не светится.
 *
 * Безопасность: TTL 60с, single-use (атомарный UPDATE ... used=true RETURNING).
 */

const TTL_MS = 60_000;

export async function ensureAppAuthCodeSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_auth_code (
      code       text PRIMARY KEY,
      token      text NOT NULL,
      expires_at timestamptz NOT NULL,
      used       boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

/** Создать одноразовый код для bearer-токена сессии. */
export async function mintCode(token: string): Promise<string> {
  await ensureAppAuthCodeSchema();
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  await pool.query(
    `INSERT INTO app_auth_code (code, token, expires_at) VALUES ($1, $2, $3)`,
    [code, token, expiresAt]
  );
  // Лениво подчищаем протухшие коды (без крона).
  await pool.query(`DELETE FROM app_auth_code WHERE expires_at < now() - interval '1 hour'`);
  return code;
}

/**
 * Обменять код на токен. Атомарно помечает use=true, чтобы код нельзя было
 * применить дважды (защита от гонки/перехвата). Возвращает null, если код
 * не найден / уже использован / протух.
 */
export async function redeemCode(code: string): Promise<string | null> {
  await ensureAppAuthCodeSchema();
  const { rows } = await pool.query(
    `UPDATE app_auth_code SET used = true
     WHERE code = $1 AND used = false AND expires_at > now()
     RETURNING token`,
    [code]
  );
  return rows.length ? (rows[0].token as string) : null;
}
