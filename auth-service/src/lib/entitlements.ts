import { pool } from "./db";

/**
 * Источник истины по подписке — таблица user_entitlement.
 * Обновляется вебхуками Polar (onCustomerStateChanged), читается из /api/me.
 *
 * Почему отдельная таблица, а не запрос в Polar на каждый /api/me:
 *  - быстрее (без внешнего вызова на горячем пути),
 *  - переживает кратковременную недоступность Polar.
 */

export async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_entitlement (
      user_id            text PRIMARY KEY,
      customer_id        text,
      plan               text NOT NULL DEFAULT 'free',
      status             text,
      current_period_end timestamptz,
      updated_at         timestamptz NOT NULL DEFAULT now()
    );
  `);
  // Миграции — только ADD COLUMN IF NOT EXISTS (без отдельных migration-файлов).
  // auto_trial_granted_at: одноразовость авто-триала (см. startAutoTrial).
  // user_source: из какого билда пришёл юзер ('trial' | 'direct'), пишется один раз.
  await pool.query(`
    ALTER TABLE user_entitlement ADD COLUMN IF NOT EXISTS auto_trial_granted_at timestamptz;
    ALTER TABLE user_entitlement ADD COLUMN IF NOT EXISTS user_source text;
  `);
}

type AnyObj = Record<string, any>;

function isObj(value: unknown): value is AnyObj {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const s = asString(value);
    if (s) return s;
  }
  return undefined;
}

function asObjArray(value: unknown): AnyObj[] {
  return Array.isArray(value) ? value.filter(isObj) : [];
}

function activeSubList(value: unknown): AnyObj[] {
  return asObjArray(value).map((s) => ({
    ...s,
    status: s.status ?? "active",
  }));
}

export function polarEventType(payload: AnyObj): string {
  return String(payload?.type ?? payload?.event_type ?? payload?.eventType ?? "");
}

function payloadData(payload: AnyObj): AnyObj {
  const data = payload?.data ?? payload ?? {};
  return isObj(data) ? data : {};
}

function pickUserId(data: AnyObj, active?: AnyObj): string | undefined {
  return firstString(
    data?.externalId,
    data?.external_id,
    data?.customerExternalId,
    data?.customer_external_id,
    data?.customer?.externalId,
    data?.customer?.external_id,
    data?.subscription?.customerExternalId,
    data?.subscription?.customer_external_id,
    data?.subscription?.customer?.externalId,
    data?.subscription?.customer?.external_id,
    active?.externalId,
    active?.external_id,
    active?.customerExternalId,
    active?.customer_external_id,
    active?.customer?.externalId,
    active?.customer?.external_id
  );
}

function pickCustomerId(
  data: AnyObj,
  active?: AnyObj,
  opts: { allowDataId?: boolean } = {}
): string | undefined {
  return firstString(
    data?.customerId,
    data?.customer_id,
    data?.customer?.id,
    data?.subscription?.customerId,
    data?.subscription?.customer_id,
    data?.subscription?.customer?.id,
    active?.customerId,
    active?.customer_id,
    active?.customer?.id,
    opts.allowDataId ? data?.id : undefined
  );
}

function collectSubscriptions(data: AnyObj): AnyObj[] {
  const subs = [
    ...activeSubList(data?.activeSubscriptions),
    ...activeSubList(data?.active_subscriptions),
    ...asObjArray(data?.subscriptions),
    ...activeSubList(data?.customer?.activeSubscriptions),
    ...activeSubList(data?.customer?.active_subscriptions),
  ];
  if (isObj(data?.subscription)) subs.push(data.subscription);

  // subscription.* вебхуки присылают саму подписку в data, без списка.
  if (
    typeof data?.status === "string" &&
    (data?.currentPeriodEnd ||
      data?.current_period_end ||
      data?.customerId ||
      data?.customer_id ||
      data?.subscriptionId ||
      data?.subscription_id)
  ) {
    subs.push(data);
  }

  return subs;
}

function activeSubscription(data: AnyObj): AnyObj | undefined {
  return collectSubscriptions(data).find((s) =>
    ["active", "trialing"].includes(String(s?.status).toLowerCase())
  );
}

function periodEnd(active?: AnyObj): string | null {
  return (
    firstString(
      active?.currentPeriodEnd,
      active?.current_period_end,
      active?.endsAt,
      active?.ends_at
    ) ?? null
  );
}

async function writeEntitlement(input: {
  userId: string;
  customerId?: string;
  plan: "free" | "pro";
  status: string;
  periodEnd: string | null;
  source: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO user_entitlement (user_id, customer_id, plan, status, current_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id) DO UPDATE SET
       customer_id        = COALESCE(EXCLUDED.customer_id, user_entitlement.customer_id),
       plan               = EXCLUDED.plan,
       status             = EXCLUDED.status,
       current_period_end = CASE
         WHEN EXCLUDED.plan = 'pro' AND EXCLUDED.current_period_end IS NULL
           THEN user_entitlement.current_period_end
         ELSE EXCLUDED.current_period_end
       END,
       updated_at         = now()`,
    [input.userId, input.customerId ?? null, input.plan, input.status, input.periodEnd]
  );
  console.log(
    `[entitlements] source=${input.source} user=${input.userId} → plan=${input.plan} status=${input.status}`
  );
}

export type Entitlement = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  /** true = подпиской управляет Polar (customer_id задан) — тогда есть смысл
   *  показывать кнопку «Управлять подпиской» (customer portal). Наш триал без
   *  карты (customer_id NULL) в портале Polar не отображается. */
  managedByPolar: boolean;
  /** Источник юзера ('trial' | 'direct'), null = ещё не зафиксирован (легаси). */
  userSource: string | null;
};

/**
 * Разбирает payload вебхука customer.state_changed и пишет план.
 *
 * ВНИМАНИЕ: точные имена полей зависят от версии Polar SDK/вебхука.
 * Здесь читаем защитно (camelCase + snake_case). После первого реального
 * вебхука в sandbox сверь форму payload по логам (onPayload) и при
 * необходимости поправь маппинг. См. README → «Проверка вебхука».
 */
export async function upsertEntitlementFromCustomerState(payload: AnyObj): Promise<void> {
  await ensureSchema();
  const data = payloadData(payload);

  const active = activeSubscription(data);
  const userId = pickUserId(data, active);
  const customerId = pickCustomerId(data, active, { allowDataId: true });

  if (!userId) {
    console.warn(
      "[entitlements] нет externalId в payload customer.state — пропуск.",
      JSON.stringify(data).slice(0, 800)
    );
    return;
  }

  const plan: "free" | "pro" = active ? "pro" : "free";
  const status = String(active?.status ?? "none");
  await writeEntitlement({
    userId,
    customerId,
    plan,
    status,
    periodEnd: periodEnd(active),
    source: "customer.state_changed",
  });
}

/**
 * subscription.* вебхуки иногда приходят раньше customer.state_changed.
 * Используем их только для повышения до PRO, чтобы отдельный canceled/past_due
 * payload не затёр клиента, у которого теоретически есть другая активная
 * подписка. Дегрейд оставляем customer.state_changed.
 */
export async function upsertEntitlementFromSubscriptionState(payload: AnyObj): Promise<void> {
  await ensureSchema();
  const data = payloadData(payload);
  const active = activeSubscription(data);
  if (!active) return;

  const userId = pickUserId(data, active);
  if (!userId) {
    console.warn(
      `[entitlements] нет externalId в payload ${polarEventType(payload) || "subscription"} — пропуск.`,
      JSON.stringify(data).slice(0, 800)
    );
    return;
  }

  await writeEntitlement({
    userId,
    customerId: pickCustomerId(data, active),
    plan: "pro",
    status: String(active.status),
    periodEnd: periodEnd(active),
    source: polarEventType(payload) || "subscription",
  });
}

/**
 * order.paid нужен как страховка для покупки во время нашего no-card trial:
 * пользователь уже plan=pro, поэтому клиент мог остановить polling до того,
 * как customer.state_changed записал customer_id. Платный заказ по одному из
 * наших subscription-продуктов сразу переводит entitlement в Polar-managed PRO.
 */
export async function upsertEntitlementFromOrderPaid(payload: AnyObj): Promise<void> {
  await ensureSchema();
  const data = payloadData(payload);
  const productId = firstString(
    data?.productId,
    data?.product_id,
    data?.product?.id,
    data?.subscription?.productId,
    data?.subscription?.product_id,
    data?.subscription?.product?.id
  );
  const knownProductIds = [
    process.env.POLAR_PRODUCT_ID_MONTHLY,
    process.env.POLAR_PRODUCT_ID_YEARLY,
    process.env.POLAR_PRODUCT_ID_TRIAL7,
  ].filter(Boolean);
  if (!productId || !knownProductIds.includes(productId)) return;

  const active = isObj(data?.subscription) ? data.subscription : undefined;
  const userId = pickUserId(data, active);
  if (!userId) {
    console.warn(
      "[entitlements] нет externalId в payload order.paid — пропуск.",
      JSON.stringify(data).slice(0, 800)
    );
    return;
  }

  const status = ["active", "trialing"].includes(String(active?.status).toLowerCase())
    ? String(active?.status)
    : "active";

  await writeEntitlement({
    userId,
    customerId: pickCustomerId(data, active),
    plan: "pro",
    status,
    periodEnd: periodEnd(active ?? data),
    source: "order.paid",
  });
}

export async function getEntitlement(userId: string): Promise<Entitlement> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT plan, status, current_period_end, customer_id, user_source
     FROM user_entitlement WHERE user_id = $1`,
    [userId]
  );
  if (rows.length === 0) {
    return {
      plan: "free",
      status: "none",
      currentPeriodEnd: null,
      managedByPolar: false,
      userSource: null,
    };
  }

  const status: string = rows[0].status ?? "none";
  const periodEnd: Date | null = rows[0].current_period_end
    ? new Date(rows[0].current_period_end)
    : null;

  // НАШ триал по промокоду (без карты, customer_id IS NULL, без вебхуков) истекает
  // САМ по дате: после current_period_end → free. Триалы и подписки Polar
  // (customer_id задан) по дате НЕ трогаем — их статус ведёт вебхук Polar.
  const trialExpired =
    status === "trialing" &&
    !rows[0].customer_id &&
    periodEnd !== null &&
    periodEnd.getTime() < Date.now();

  const plan: "free" | "pro" = !trialExpired && rows[0].plan === "pro" ? "pro" : "free";

  return {
    plan,
    status: trialExpired ? "expired" : status,
    currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
    managedByPolar: Boolean(rows[0].customer_id),
    userSource: rows[0].user_source ?? null,
  };
}

/**
 * Фиксирует источник юзера ('trial' | 'direct') ОДИН раз: повторные вызовы с
 * другим значением ничего не меняют (COALESCE со старым значением). Нужен,
 * чтобы direct-юзер после автообновления на trial-артефакт не получил
 * авто-триал задним числом.
 */
export async function recordUserSource(userId: string, source: "trial" | "direct"): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO user_entitlement (user_id, user_source)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       user_source = COALESCE(user_entitlement.user_source, EXCLUDED.user_source)`,
    [userId, source]
  );
}

export async function hasUsedAutoTrial(userId: string): Promise<boolean> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT auto_trial_granted_at FROM user_entitlement WHERE user_id = $1`,
    [userId]
  );
  return Boolean(rows[0]?.auto_trial_granted_at);
}

export type TrialResult =
  | { ok: true; currentPeriodEnd: string }
  | { ok: false; reason: "already_pro" };

/**
 * Выдаёт бесплатный триал на N дней (без карты, без Polar). Пишет в ту же
 * таблицу user_entitlement: plan=pro, status=trialing, срок = now + days.
 * По решению заказчицы повторных проверок НЕТ — код можно активировать
 * многократно. Единственная защита: не затираем активную ПЛАТНУЮ подписку.
 */
export async function startTrial(userId: string, days: number): Promise<TrialResult> {
  await ensureSchema();

  const { rows } = await pool.query(
    `SELECT plan, status FROM user_entitlement WHERE user_id = $1`,
    [userId]
  );
  if (rows.length > 0 && rows[0].plan === "pro" && rows[0].status === "active") {
    return { ok: false, reason: "already_pro" };
  }

  const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO user_entitlement (user_id, customer_id, plan, status, current_period_end, updated_at)
     VALUES ($1, NULL, 'pro', 'trialing', $2, now())
     ON CONFLICT (user_id) DO UPDATE SET
       plan               = 'pro',
       status             = 'trialing',
       current_period_end = EXCLUDED.current_period_end,
       updated_at         = now()`,
    [userId, periodEnd.toISOString()]
  );
  console.log(`[entitlements] trial granted user=${userId} until=${periodEnd.toISOString()}`);
  return { ok: true, currentPeriodEnd: periodEnd.toISOString() };
}

export type AutoTrialResult =
  | { ok: true; currentPeriodEnd: string }
  | { ok: false; code: "already_used" | "not_eligible" | "already_active" };

/**
 * Авто-триал для trial-билда: выдаётся СТРОГО один раз на аккаунт
 * (маркер auto_trial_granted_at) и только юзерам с user_source='trial'
 * или без source (легаси до введения источников). Активную платную подписку
 * и активный триал не затирает. Промокодный startTrial выше не трогаем:
 * по решению заказчицы промокоды остаются многоразовыми.
 */
export async function startAutoTrial(userId: string, days: number): Promise<AutoTrialResult> {
  await ensureSchema();

  const { rows } = await pool.query(
    `SELECT auto_trial_granted_at, user_source FROM user_entitlement WHERE user_id = $1`,
    [userId]
  );
  if (rows.length > 0 && rows[0].auto_trial_granted_at) {
    return { ok: false, code: "already_used" };
  }
  if (rows.length > 0 && rows[0].user_source === "direct") {
    return { ok: false, code: "not_eligible" };
  }

  // getEntitlement сам гасит истёкший наш триал, поэтому plan=pro здесь
  // означает действительно активную подписку или живой триал — не трогаем.
  const ent = await getEntitlement(userId);
  if (ent.plan === "pro") {
    return { ok: false, code: "already_active" };
  }

  const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  // customer_id сбрасываем в NULL: это признак «наш триал без карты» —
  // именно по нему getEntitlement гасит триал по дате (Polar-вебхук про этот
  // триал ничего не знает и не пришлёт). Актуальный customer_id Polar всё
  // равно перезапишет вебхуком при первой оплате (привязка по external_id).
  await pool.query(
    `INSERT INTO user_entitlement
       (user_id, customer_id, plan, status, current_period_end, auto_trial_granted_at, updated_at)
     VALUES ($1, NULL, 'pro', 'trialing', $2, now(), now())
     ON CONFLICT (user_id) DO UPDATE SET
       customer_id           = NULL,
       plan                  = 'pro',
       status                = 'trialing',
       current_period_end    = EXCLUDED.current_period_end,
       auto_trial_granted_at = now(),
       updated_at            = now()`,
    [userId, periodEnd.toISOString()]
  );
  console.log(`[entitlements] auto-trial granted user=${userId} until=${periodEnd.toISOString()}`);
  return { ok: true, currentPeriodEnd: periodEnd.toISOString() };
}
