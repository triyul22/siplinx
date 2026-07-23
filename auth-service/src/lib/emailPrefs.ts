import crypto from "crypto";
import { pool } from "./db";

/**
 * Настройки email-рассылок и лог отправок.
 *
 * Две таблицы:
 *  - user_email_prefs: locale + согласие на рекламные письма (marketing_opt_in)
 *    + факт отписки (unsubscribed_at). marketing_opt_in DEFAULT false — win-back
 *    (реклама) только по явному согласию (GDPR/38-ФЗ). Сервисные письма (1-4,
 *    paid_welcome) приходят всем НЕотписавшимся.
 *  - email_log: ровно одна отправка одного шаблона одному юзеру (уникальный
 *    индекс user_id+template) — это и есть идемпотентность секвенции.
 */

export async function ensureEmailSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_email_prefs (
      user_id            text PRIMARY KEY,
      locale             text,
      marketing_opt_in   boolean NOT NULL DEFAULT false,
      marketing_opt_in_at timestamptz,
      unsubscribed_at    timestamptz
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id        serial PRIMARY KEY,
      user_id   text NOT NULL,
      template  text NOT NULL,
      sent_at   timestamptz NOT NULL DEFAULT now(),
      resend_id text,
      status    text
    );
  `);
  // Идемпотентность: один шаблон одному юзеру ровно один раз.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS email_log_user_template_uniq
      ON email_log (user_id, template);
  `);
}

export type EmailPrefs = {
  locale: string | null;
  marketingOptIn: boolean;
  unsubscribedAt: string | null;
};

export async function getEmailPrefs(userId: string): Promise<EmailPrefs> {
  await ensureEmailSchema();
  const { rows } = await pool.query(
    `SELECT locale, marketing_opt_in, unsubscribed_at
     FROM user_email_prefs WHERE user_id = $1`,
    [userId]
  );
  if (rows.length === 0) {
    return { locale: null, marketingOptIn: false, unsubscribedAt: null };
  }
  return {
    locale: rows[0].locale ?? null,
    marketingOptIn: Boolean(rows[0].marketing_opt_in),
    unsubscribedAt: rows[0].unsubscribed_at
      ? new Date(rows[0].unsubscribed_at).toISOString()
      : null,
  };
}

/**
 * Фиксирует locale юзера (для выбора языка письма). Пишется столько раз,
 * сколько приходит с клиента — язык может меняться, берём последний.
 */
export async function recordLocale(userId: string, locale: string): Promise<void> {
  await ensureEmailSchema();
  const clean = locale.trim().slice(0, 16);
  if (!clean) return;
  await pool.query(
    `INSERT INTO user_email_prefs (user_id, locale)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET locale = EXCLUDED.locale`,
    [userId, clean]
  );
}

/**
 * Согласие на рекламную рассылку. optIn=true пишет timestamp согласия
 * (доказательство). optIn=false снимает согласие, но НЕ отписывает от
 * сервисных писем (для этого есть unsubscribe).
 */
export async function setMarketingOptIn(userId: string, optIn: boolean): Promise<void> {
  await ensureEmailSchema();
  await pool.query(
    `INSERT INTO user_email_prefs (user_id, marketing_opt_in, marketing_opt_in_at)
     VALUES ($1, $2, CASE WHEN $2 THEN now() ELSE NULL END)
     ON CONFLICT (user_id) DO UPDATE SET
       marketing_opt_in    = EXCLUDED.marketing_opt_in,
       marketing_opt_in_at = CASE WHEN EXCLUDED.marketing_opt_in
                                  THEN COALESCE(user_email_prefs.marketing_opt_in_at, now())
                                  ELSE NULL END`,
    [userId, optIn]
  );
}

/** Полная отписка (клик по ссылке в письме, bounce, жалоба на спам). */
export async function unsubscribe(userId: string): Promise<void> {
  await ensureEmailSchema();
  await pool.query(
    `INSERT INTO user_email_prefs (user_id, marketing_opt_in, unsubscribed_at)
     VALUES ($1, false, now())
     ON CONFLICT (user_id) DO UPDATE SET
       marketing_opt_in = false,
       unsubscribed_at  = now()`,
    [userId]
  );
}

// --- Подписанный токен отписки (HMAC user_id) ---
// Ссылка отписки в письме не должна требовать логина, но и не должна
// позволять отписать чужого юзера перебором id. HMAC c серверным секретом.

function unsubSecret(): string {
  return process.env.EMAIL_UNSUB_SECRET || process.env.BETTER_AUTH_SECRET || "dev-unsub-secret";
}

export function makeUnsubToken(userId: string): string {
  const sig = crypto
    .createHmac("sha256", unsubSecret())
    .update(userId)
    .digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${sig}`;
}

export function verifyUnsubToken(token: string): string | null {
  const [idPart, sig] = token.split(".");
  if (!idPart || !sig) return null;
  let userId: string;
  try {
    userId = Buffer.from(idPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = crypto
    .createHmac("sha256", unsubSecret())
    .update(userId)
    .digest("base64url");
  // Постоянное по времени сравнение.
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  return userId;
}

// --- email_log ---

/** Уже отправляли этот шаблон этому юзеру? */
export async function wasSent(userId: string, template: string): Promise<boolean> {
  await ensureEmailSchema();
  const { rows } = await pool.query(
    `SELECT 1 FROM email_log WHERE user_id = $1 AND template = $2 LIMIT 1`,
    [userId, template]
  );
  return rows.length > 0;
}

/**
 * Резервирует отправку (вставляет строку в email_log). Возвращает true, если
 * строка вставлена именно этим вызовом — тогда можно слать. Если false, письмо
 * уже отправлено/резервируется параллельно: НЕ слать (защита от дублей и от
 * гонки двух cron-запусков). resend_id/status проставляем после отправки.
 */
export async function reserveSend(userId: string, template: string): Promise<boolean> {
  await ensureEmailSchema();
  const { rows } = await pool.query(
    `INSERT INTO email_log (user_id, template, status)
     VALUES ($1, $2, 'sending')
     ON CONFLICT (user_id, template) DO NOTHING
     RETURNING id`,
    [userId, template]
  );
  return rows.length > 0;
}

export async function markSent(
  userId: string,
  template: string,
  resendId: string | null,
  status: string
): Promise<void> {
  await pool.query(
    `UPDATE email_log SET resend_id = $3, status = $4, sent_at = now()
     WHERE user_id = $1 AND template = $2`,
    [userId, template, resendId, status]
  );
}

/** Откат резерва, если отправка упала — чтобы следующий cron попробовал снова. */
export async function releaseSend(userId: string, template: string): Promise<void> {
  await pool.query(
    `DELETE FROM email_log WHERE user_id = $1 AND template = $2 AND status = 'sending'`,
    [userId, template]
  );
}

/** Обновление статуса по вебхуку Resend (opened/clicked/bounced/complained). */
export async function updateStatusByResendId(resendId: string, status: string): Promise<void> {
  await ensureEmailSchema();
  await pool.query(`UPDATE email_log SET status = $2 WHERE resend_id = $1`, [resendId, status]);
}
