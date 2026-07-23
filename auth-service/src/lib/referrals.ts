import crypto from "crypto";
import { pool } from "./db";

/**
 * Реферальная программа для блогеров (см. TZ-referral-program.md).
 *
 * Механика: клик по /r/<code> → cookie siplinx_ref (90 дней) → первый вход
 * через браузерный OAuth-флоу → write-once атрибуция юзера к партнёру →
 * каждый order.paid по trial7-продукту начисляет партнёру % от суммы (ledger).
 * Выплаты вручную (PayPal, ежемесячно), система только учитывает.
 *
 * Все суммы: integer-центы USD. Никаких float в деньгах.
 */

export const REF_COOKIE = "siplinx_ref";
export const REF_COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 дней, раскрыто партнёрам

const CODE_RE = /^[a-z0-9-]{3,32}$/;

export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toLowerCase();
  return CODE_RE.test(code) ? code : null;
}

export async function ensureReferralSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_partner (
      code        text PRIMARY KEY,
      name        text NOT NULL,
      contact     text,
      commission_pct numeric,
      active      boolean NOT NULL DEFAULT true,
      clicks      bigint  NOT NULL DEFAULT 0,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_attribution (
      user_id     text PRIMARY KEY,
      code        text NOT NULL REFERENCES referral_partner(code),
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_commission (
      order_id           text PRIMARY KEY,
      user_id            text NOT NULL,
      code               text NOT NULL,
      order_amount_cents integer NOT NULL,
      commission_cents   integer NOT NULL,
      currency           text NOT NULL DEFAULT 'usd',
      status             text NOT NULL DEFAULT 'accrued',
      created_at         timestamptz NOT NULL DEFAULT now(),
      paid_at            timestamptz
    );
  `);
}

// --- Партнёры ---

export type Partner = {
  code: string;
  name: string;
  contact: string | null;
  commissionPct: number; // эффективная ставка (per-partner либо дефолт из env)
  active: boolean;
  clicks: number;
};

function defaultPct(): number {
  return Number(process.env.REFERRAL_COMMISSION_PCT ?? "50") || 50;
}

export async function upsertPartner(input: {
  code: string;
  name: string;
  contact?: string;
  commissionPct?: number;
}): Promise<void> {
  await ensureReferralSchema();
  await pool.query(
    `INSERT INTO referral_partner (code, name, contact, commission_pct, active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (code) DO UPDATE SET
       name           = EXCLUDED.name,
       contact        = COALESCE(EXCLUDED.contact, referral_partner.contact),
       commission_pct = COALESCE(EXCLUDED.commission_pct, referral_partner.commission_pct),
       active         = true`,
    [input.code, input.name, input.contact ?? null, input.commissionPct ?? null]
  );
}

export async function deactivatePartner(code: string): Promise<boolean> {
  await ensureReferralSchema();
  const { rowCount } = await pool.query(
    `UPDATE referral_partner SET active = false WHERE code = $1`,
    [code]
  );
  return (rowCount ?? 0) > 0;
}

export async function getPartner(code: string): Promise<Partner | null> {
  await ensureReferralSchema();
  const { rows } = await pool.query(
    `SELECT code, name, contact, commission_pct, active, clicks
     FROM referral_partner WHERE code = $1`,
    [code]
  );
  if (!rows.length) return null;
  return {
    code: rows[0].code,
    name: rows[0].name,
    contact: rows[0].contact ?? null,
    commissionPct:
      rows[0].commission_pct !== null ? Number(rows[0].commission_pct) : defaultPct(),
    active: Boolean(rows[0].active),
    clicks: Number(rows[0].clicks),
  };
}

/** Инкремент кликов активного партнёра. true = партнёр существует и активен. */
export async function registerClick(code: string): Promise<boolean> {
  await ensureReferralSchema();
  const { rowCount } = await pool.query(
    `UPDATE referral_partner SET clicks = clicks + 1 WHERE code = $1 AND active = true`,
    [code]
  );
  return (rowCount ?? 0) > 0;
}

// --- Атрибуция ---

/**
 * Write-once привязка юзера к партнёру (первый код навсегда, ON CONFLICT DO
 * NOTHING). Вызывается из финалов OAuth-флоу; ошибки НЕ должны ломать логин —
 * вызывающий код оборачивает в try/catch.
 */
export async function attributeUser(userId: string, rawCode: string): Promise<void> {
  const code = normalizeCode(rawCode);
  if (!code) return;
  const partner = await getPartner(code);
  if (!partner || !partner.active) return;
  const { rowCount } = await pool.query(
    `INSERT INTO referral_attribution (user_id, code)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, code]
  );
  if ((rowCount ?? 0) > 0) {
    console.log(`[referral] attributed user=${userId} code=${code}`);
  }
}

// --- Комиссии (вебхуки Polar) ---

type AnyObj = Record<string, any>;

/**
 * order.paid: начислить комиссию, если юзер атрибуцирован и продукт = TRIAL7.
 * Payload разбираем защитно (camelCase + snake_case): форма полей Polar
 * нестабильна между версиями SDK (см. upsertEntitlementFromCustomerState).
 * Никогда не кидает наружу: Polar ретраит «неуспешные» доставки бесконечно.
 */
export async function handleOrderPaid(payload: AnyObj): Promise<void> {
  try {
    await ensureReferralSchema();
    const data: AnyObj = payload?.data ?? payload ?? {};

    const orderId: string | undefined = data?.id;
    const userId: string | undefined =
      data?.customer?.externalId ??
      data?.customer?.external_id ??
      data?.externalId ??
      data?.external_id;
    const productId: string | undefined =
      data?.productId ?? data?.product_id ?? data?.product?.id;
    // gross-сумма списания в центах (сверить с реальным payload по логам).
    const amountCents: number = Number(data?.amount ?? data?.totalAmount ?? data?.total_amount ?? 0);
    const currency: string = String(data?.currency ?? "usd").toLowerCase();

    if (!orderId || !userId || !amountCents) return;
    // Комиссия только на trial7-продукт ($4/нед); direct ($2/нед) не участвует.
    if (!process.env.POLAR_PRODUCT_ID_TRIAL7 || productId !== process.env.POLAR_PRODUCT_ID_TRIAL7) {
      return;
    }

    const { rows } = await pool.query(
      `SELECT code FROM referral_attribution WHERE user_id = $1`,
      [userId]
    );
    if (!rows.length) return;
    const code: string = rows[0].code;

    const partner = await getPartner(code);
    const pct = partner?.commissionPct ?? defaultPct();
    const commissionCents = Math.round((amountCents * pct) / 100);

    // order_id PK + DO NOTHING = идемпотентность ретраев вебхука.
    const ins = await pool.query(
      `INSERT INTO referral_commission
         (order_id, user_id, code, order_amount_cents, commission_cents, currency)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (order_id) DO NOTHING`,
      [orderId, userId, code, amountCents, commissionCents, currency]
    );
    if ((ins.rowCount ?? 0) > 0) {
      console.log(
        `[referral] order=${orderId} code=${code} amount=${amountCents} commission=${commissionCents} (${pct}%)`
      );
    }
  } catch (e) {
    console.error("[referral] handleOrderPaid failed:", e);
  }
}

/** order.refunded: комиссия по этому order → reversed (даже если была paid). */
export async function handleOrderRefunded(payload: AnyObj): Promise<void> {
  try {
    await ensureReferralSchema();
    const data: AnyObj = payload?.data ?? payload ?? {};
    const orderId: string | undefined = data?.id;
    if (!orderId) return;
    const { rowCount } = await pool.query(
      `UPDATE referral_commission SET status = 'reversed' WHERE order_id = $1`,
      [orderId]
    );
    if ((rowCount ?? 0) > 0) console.log(`[referral] order=${orderId} reversed`);
  } catch (e) {
    console.error("[referral] handleOrderRefunded failed:", e);
  }
}

// --- Отчёты ---

export type PartnerReport = {
  code: string;
  name: string;
  contact: string | null;
  commissionPct: number;
  active: boolean;
  clicks: number;
  attributedUsers: number;
  paidOrders: number;
  ordersSumCents: number;
  accruedCents: number;
  reversedCents: number;
  paidOutCents: number;
  unpaidCents: number;
};

export async function buildReport(onlyCode?: string): Promise<PartnerReport[]> {
  await ensureReferralSchema();
  const { rows } = await pool.query(
    `SELECT p.code, p.name, p.contact, p.commission_pct, p.active, p.clicks,
            (SELECT count(*) FROM referral_attribution a WHERE a.code = p.code) AS attributed_users,
            (SELECT count(*) FROM referral_commission c WHERE c.code = p.code AND c.status <> 'reversed') AS paid_orders,
            COALESCE((SELECT sum(c.order_amount_cents) FROM referral_commission c WHERE c.code = p.code AND c.status <> 'reversed'), 0) AS orders_sum,
            COALESCE((SELECT sum(c.commission_cents) FROM referral_commission c WHERE c.code = p.code AND c.status = 'accrued'), 0) AS accrued,
            COALESCE((SELECT sum(c.commission_cents) FROM referral_commission c WHERE c.code = p.code AND c.status = 'reversed'), 0) AS reversed,
            COALESCE((SELECT sum(c.commission_cents) FROM referral_commission c WHERE c.code = p.code AND c.status = 'paid'), 0) AS paid_out
       FROM referral_partner p
      WHERE ($1::text IS NULL OR p.code = $1)
      ORDER BY p.created_at`,
    [onlyCode ?? null]
  );
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    contact: r.contact ?? null,
    commissionPct: r.commission_pct !== null ? Number(r.commission_pct) : defaultPct(),
    active: Boolean(r.active),
    clicks: Number(r.clicks),
    attributedUsers: Number(r.attributed_users),
    paidOrders: Number(r.paid_orders),
    ordersSumCents: Number(r.orders_sum),
    accruedCents: Number(r.accrued),
    reversedCents: Number(r.reversed),
    paidOutCents: Number(r.paid_out),
    unpaidCents: Number(r.accrued),
  }));
}

export async function markPaid(code: string): Promise<{ rows: number; cents: number }> {
  await ensureReferralSchema();
  const { rows } = await pool.query(
    `UPDATE referral_commission
        SET status = 'paid', paid_at = now()
      WHERE code = $1 AND status = 'accrued'
      RETURNING commission_cents`,
    [code]
  );
  const cents = rows.reduce((s, r) => s + Number(r.commission_cents), 0);
  return { rows: rows.length, cents };
}

// --- Токен страницы статистики (HMAC, по образцу emailPrefs.makeUnsubToken) ---
// Партнёр открывает /partner/<code>?token=... без логина; токен не даёт
// подобрать чужую страницу перебором кодов.

function statsSecret(): string {
  return process.env.REFERRAL_ADMIN_SECRET || process.env.BETTER_AUTH_SECRET || "dev-referral-secret";
}

export function makeStatsToken(code: string): string {
  return crypto.createHmac("sha256", statsSecret()).update(`stats:${code}`).digest("base64url");
}

export function verifyStatsToken(code: string, token: string): boolean {
  const expected = makeStatsToken(code);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
